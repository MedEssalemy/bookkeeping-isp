import uuid

from fastapi.testclient import TestClient

from app.main import app


def uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def test_requires_token():
    with TestClient(app) as anon:
        assert anon.get("/api/v1/proposals?direction=issued").status_code == 401


def test_bad_login_rejected():
    with TestClient(app) as anon:
        r = anon.post("/api/v1/auth/login", json={"email": "nobody@isp.com", "password": "x"})
        assert r.status_code == 401


def test_seeded_reference_data(client):
    assert len(client.get("/config-lists/job_codes").json()) >= 20
    terms = {i["label"]: i["delay_days"] for i in client.get("/config-lists/payment_terms").json()}
    assert terms["Net 30"] == 30
    assert client.get("/mp-destinations").json()[0]["final_destination"]
    assert client.get("/tax-rates/lookup", params={"city": "houston", "state": "TX"}).json()["rate"] == 0.0825


def test_config_list_crud(client):
    assert client.post("/config-lists/job_codes/items", json={"label": "Service"}).status_code == 409
    item = client.post("/config-lists/job_codes/items", json={"label": uid("Code")}).json()
    r = client.patch(f"/config-lists/job_codes/items/{item['id']}", json={"active": False})
    assert r.json()["active"] is False
    assert all(i["id"] != item["id"] for i in client.get("/config-lists/job_codes").json())
    assert client.delete(f"/config-lists/job_codes/items/{item['id']}").status_code == 200


def test_client_contacts(client):
    name = uid("Person")
    c = client.post("/clients/contacts", json={"name": name, "address": "1 Main St", "city": "Austin", "state": "Texas", "zip": "78701"}).json()
    assert c["address_full"] == "1 Main St, Austin, TX 78701"
    assert name in client.get("/clients/names", params={"q": name}).json()
    assert len(client.get("/clients/lookup", params={"name": name}).json()) == 1
    assert client.delete(f"/clients/contacts/{c['id']}").status_code == 200


def test_proposal_lifecycle(client):
    number = client.get("/proposals/next-number", params={"type": "standard"}).json()["number"]
    assert number.startswith("Q-")
    body = {
        "number": number, "type": "Standard", "direction": "issued", "status": "Draft", "date": "2026-10-01",
        "client_name": "CI Client", "taxable": True, "tax_rate": 0.0825, "proposal_valid_till": "",
        "line_items": [
            {"job_code": "Service", "description": "x", "qty": 2, "rate": 100},
            {"job_code": "Parts", "description": "lump sum", "qty": None, "rate": 50},
        ],
    }
    r = client.post("/proposals", json=body)
    assert r.status_code == 201
    p = r.json()
    assert p["subtotal"] == 250 and abs(p["total"] - 270.63) < 0.01

    # Duplicate number -> 409, then the confirmed delete-and-replace.
    assert client.post("/proposals", json=body).status_code == 409
    p2 = client.post("/proposals", json={**body, "replace_existing": True}).json()
    assert p2["id"] != p["id"]
    assert client.get(f"/proposals/{p['id']}").status_code == 404

    listed = client.get("/proposals", params={"direction": "issued", "job_code": ["Parts"], "q": number}).json()
    assert [i["id"] for i in listed["items"]] == [p2["id"]]

    assert client.patch(f"/proposals/{p2['id']}/status", json={"status": "Accepted"}).json()["status"] == "Accepted"
    assert client.put(f"/proposals/{p2['id']}", json={**body, "type": "MP"}).status_code == 400
    assert client.delete(f"/proposals/{p2['id']}").status_code == 204


def test_rich_text_sanitized_on_save(client):
    number = client.get("/proposals/next-number", params={"type": "standard"}).json()["number"]
    p = client.post("/proposals", json={
        "number": number, "type": "Standard", "direction": "issued", "status": "Draft", "date": "2026-10-01",
        "client_name": "CI Client", "taxable": False, "tax_rate": 0, "line_items": [],
        "notes": '<p onclick="steal()">Hi <img src=x onerror="steal()"><script>steal()</script></p>',
        "services_provided": '<ul data-marker="square"><li><a href="javascript:steal()">x</a></li></ul>',
    }).json()
    saved = client.get(f"/proposals/{p['id']}").json()
    assert saved["notes"] == "<p>Hi </p>"
    assert saved["services_provided"] == '<ul data-marker="square"><li><a rel="noopener noreferrer">x</a></li></ul>'
    assert client.delete(f"/proposals/{p['id']}").status_code == 204


def test_mp_proposal_autonumber(client):
    r = client.post("/proposals", json={
        "number": "", "type": "MP", "direction": "issued", "status": "Draft", "date": "2026-10-02",
        "taxable": False, "tax_rate": 0,
        "line_items": [{"services": "Survey", "hourly_rate": 150, "hours_estimated": 4}],
    })
    m = r.json()
    assert m["number"].startswith("PQ-") and m["total"] == 600
    client.delete(f"/proposals/{m['id']}")


def test_po_invoice_chain(client):
    po_number = uid("PO")
    po = client.post("/pos", json={
        "number": po_number, "direction": "received", "status": "Open", "date": "2026-10-03",
        "client_name": "CI Client", "payment_terms": "Net 30", "taxable": False, "tax_rate": 0,
        "line_items": [{"job_code": "Service", "description": "x", "qty": 1, "rate": 1000}],
    }).json()
    assert po["total"] == 1000

    inv = client.post("/invoices", json={
        "number": uid("INV"), "direction": "issued", "status": "Unpaid", "date": "2020-01-01",
        "po_id": po["id"], "po_number": po_number, "client_name": "CI Client", "payment_terms": "Net 30",
        "taxable": False, "tax_rate": 0, "payments_credits": 0,
        "line_items": [{"job_code": "Service", "description": "x", "qty": None, "rate": 400}],
    }).json()
    assert inv["total"] == 400

    overdue = client.get("/invoices", params={"direction": "issued", "overdue": True, "q": inv["number"]}).json()
    assert overdue["items"][0]["due_date"] == "2020-01-31"

    assert client.get(f"/pos/{po['id']}/linked-invoices").json() == [inv["id"]]
    r = client.delete(f"/pos/{po['id']}")
    assert r.status_code == 409 and r.json()["detail"]["linked"] == [inv["id"]]

    paid = client.patch(f"/invoices/{inv['id']}/mark-paid").json()
    assert paid["status"] == "Paid" and paid["payments_credits"] == 400

    assert client.delete(f"/invoices/{inv['id']}").status_code == 204
    assert client.delete(f"/pos/{po['id']}").status_code == 204


def test_contractor_delete_guard_and_attachments(client):
    sub = client.post("/contractors", json={"name": uid("Sub"), "address": "2 Side St"}).json()
    inv = client.post("/invoices", json={
        "number": uid("SUB"), "direction": "received", "status": "Unpaid", "date": "2026-10-01",
        "client_name": sub["name"], "taxable": False, "tax_rate": 0, "payments_credits": 0, "line_items": [],
    }).json()
    r = client.delete(f"/contractors/{sub['id']}")
    assert r.status_code == 409 and r.json()["detail"]["count"] == 1

    att = client.post(f"/invoices/{inv['id']}/attachments", files={"file": ("hello.txt", b"hello world", "text/plain")}).json()
    assert att["size_bytes"] == 11
    assert len(client.get(f"/invoices/{inv['id']}/attachments").json()) == 1
    assert client.get(f"/attachments/{att['id']}/download").content == b"hello world"

    assert client.delete(f"/invoices/{inv['id']}").status_code == 204
    assert client.delete(f"/contractors/{sub['id']}").status_code == 200
