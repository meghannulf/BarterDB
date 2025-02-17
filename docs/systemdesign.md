# Phase I Report: BarterDB

## 1. Introduction
BarterDB is an anonymous barter system designed to facilitate secure and efficient trade exchanges without revealing user identities. The system ensures that individuals can exchange goods or services through an intermediary database that manages transactions while preserving privacy. This report outlines the initial phase of the BarterDB project, focusing on the system's design, core functionalities, and database structure.

## 2. System Overview
The BarterDB platform allows users to trade items through a secure exchange mechanism. Users list items they wish to trade and specify desired exchanges. The system matches potential trades and facilitates secure transactions through a 16-digit hash-based verification process.

## 3. Database Design

The database follows a third-normal form (3NF) structure to ensure efficiency and data integrity. The key entities and relationships include:

**Users Table:** Stores user details (hashed passwords, contact information).

**Items Table:** Contains item details, including description, category, and owner ID.

**Transactions Table:** Tracks ongoing and completed exchanges with hash verification.

**Equivalence Table:** Defines value equivalencies for traded goods.

**Entity-Relationship (ER) Diagram:**  
*(Figure 1: ER Diagram illustrating relationships between key entities.)*

### Database Keys

**Users Table:**

- `user_id` (Primary Key)
- `name`
- `email`
- `password_hash`
- `phone`
- `address`
- `role`
- `status`
- `created_at`

**Items Table:**

- `item_id` (Primary Key)
- `user_id` (Foreign Key)
- `name`
- `description`
- `item_type`
- `quantity`
- `status`

**Transactions Table:**

- `transaction_id` (Primary Key)
- `item_id` (Foreign Key)
- `user_id` (Foreign Key)
- `partner_id` (Foreign Key)
- `hash_key`
- `status`
- `cost_summary`
- `start_date`
- `end_date`

**Contact Messages Table:**

- `message_id` (Primary Key)
- `name`
- `email`
- `message`
- `received_at`


## 4. User Interface Design

- **User Registration and Authentication**: Secure sign-up with password hashing and email verification.
- **Item Posting Interface**: Allows users to list items for barter and specify exchange preferences.
- **Trade Dashboard**: Displays active and completed transactions.

## 5. Secure Exchange Algorithm

1. Users list items for trade.
2. System matches potential exchanges based on the Equivalence Table.
3. A 16-digit hash key is generated, split into two halves, and distributed securely.
4. Items are sent to the database for verification.
5. The system ensures successful item receipt before completing the exchange.

## 6. Database Keys

### Primary Keys

Each table has a unique identifier:

- **Users Table**:
  - **Primary Key:** `user_id` (auto-increment integer or UUID).

- **Items Table**:
  - **Primary Key:** `item_id`
  - **Foreign Key:** `user_id`

- **Transactions Table**:
  - **Primary Key:** `transaction_id`

- **Equivalence Table**:
  - **Primary Key:** `equivalence_id`

## 7. Development Workflow

The application workflow is divided between a Python/Flask backend and a JavaScript-powered frontend.

### A. User Account Management

1. **Registration & Account Creation:**
   - **Frontend:** Registration form.
   - **Backend:** Handle form submission, hash passwords (`bcrypt`).

2. **User Login & Authentication:**
   - **Frontend:** Login interface.
   - **Backend:** Use Flask-Login or Flask-JWT for authentication.

### B. Posting Items and Initiating Trade Requests

1. **Item Posting:**
   - **Frontend:** Form for item listing.
   - **Backend:** Store item in the database, associate with `user_id`.

2. **Trade Request Submission:**
   - **Frontend:** Interface for requesting trades.
   - **Backend:** Validate and store trade request data.

### C. Trade Matching and Secure Exchange Process

1. **Matching Algorithm:**
   - Matches trade requests against posted items using the Equivalence Table.
   - Generates a `transaction_id`.

2. **Generating and Distributing the 16-Digit Hash:**
   - **Backend:** Generates a 16-digit hash, splits it, and distributes it securely.

3. **Item Transfer Process:**
   - Validates transaction and finalizes exchange based on hash verification.
   - Records all transfer details in the database.

4. **Frontend Updates:**
   - Trade dashboards dynamically display active transactions.

## 8. Conclusion

Phase I of BarterDB establishes the foundational architecture and security measures to facilitate anonymous and fair exchanges. Future phases will focus on enhancing usability, implementing frontend development with JavaScript, and integrating Flask-based backend functionality.

**(Figure 2: System workflow illustrating trade execution process.)**
