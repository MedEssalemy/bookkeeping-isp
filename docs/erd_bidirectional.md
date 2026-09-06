::: mermaid
erDiagram

    CLIENT {
        int id PK
        string name
        string email
    }

    SUBCONTRACTOR {
        int id PK
        string name
        string contact
    }

    PROPOSAL {
        int id PK
        string reference
        string status
    }

    PURCHASE_ORDER {
        int id PK
        string po_number
        date order_date
        string status
    }

    INVOICE {
        int id PK
        string invoice_number
        date invoice_date
        decimal amount
    }

    JOB {
        int id PK
        string title
        string description
    }

    Reference {
        int id PK
        string value
    }

    CLIENT }o--o{ PROPOSAL : "receives"
    CLIENT ||--o{ PURCHASE_ORDER : "sends"
    CLIENT }o--o{ INVOICE : "receives"

    SUBCONTRACTOR }o--o{ PROPOSAL : "sends"
    SUBCONTRACTOR }o--o{ PURCHASE_ORDER : "receives"
    SUBCONTRACTOR }o--o{ INVOICE : "sends"

    PURCHASE_ORDER ||--o| PROPOSAL : "follows"
    %% Relaxed from mandatory (||--|{) to optional (|o--o{): an invoice can
    %% stand alone, or bill a proposal directly instead of going through a PO.
    PURCHASE_ORDER |o--o{ INVOICE : "bills"
    PURCHASE_ORDER }o--o{ JOB : "includes"

    PROPOSAL }o--o{ JOB : "covers"
    %% New: lets an invoice be raised straight off a proposal, no PO in between
    PROPOSAL |o--o{ INVOICE : "bills directly"

    JOB }o--o{ SUBCONTRACTOR : "handles"
    %%Direct relationship in case there is no PO
    JOB }o--o{ INVOICE : "charges"

    %%MP only
    Reference }o--o{ PROPOSAL : WHATEVER
:::