import logging
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from .models import TradeRequest, Item, EquivalenceTable, Transaction, User


class TradeMatchingService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.logger = logging.getLogger(__name__)

    def find_potential_matches(self, trade_request_id: int) -> List[Dict]:
        """
        Find potential trade matches based on item equivalence and availability.

        Args:
            trade_request_id (int): ID of the initial trade request

        Returns:
            List of potential matching trade requests
        """
        # Get the initial trade request
        initial_request = self.db.query(TradeRequest).get(trade_request_id)

        if not initial_request:
            self.logger.error(f"Trade request {trade_request_id} not found")
            return []

        # Find equivalent items and potential matches
        equivalent_items = (
            self.db.query(EquivalenceTable)
            .filter(EquivalenceTable.item1 == initial_request.item.name)
            .all()
        )

        potential_matches = []
        for equiv_item in equivalent_items:
            matching_requests = (
                self.db.query(TradeRequest)
                .join(Item)
                .filter(
                    Item.name == equiv_item.item2,
                    TradeRequest.status == "PENDING",
                    TradeRequest.user_id != initial_request.user_id,
                    Item.quantity
                    >= initial_request.requested_quantity
                    * (equiv_item.equivalence_percentage / 100),
                )
                .all()
            )

            potential_matches.extend(matching_requests)

        return potential_matches

    def create_cross_trade(
        self, request1_id: int, request2_id: int
    ) -> Optional[Transaction]:
        """
        Create a cross-trade transaction between two trade requests.

        Args:
            request1_id (int): First trade request ID
            request2_id (int): Second trade request ID

        Returns:
            Transaction object or None
        """
        try:
            request1 = self.db.query(TradeRequest).get(request1_id)
            request2 = self.db.query(TradeRequest).get(request2_id)

            if not request1 or not request2:
                self.logger.error("One or both trade requests not found")
                return None

            # Calculate transaction costs
            base_transaction_cost = 0.05  # 5% base transaction cost
            item1_cost = request1.requested_quantity * base_transaction_cost
            item2_cost = request2.requested_quantity * base_transaction_cost

            # Generate hash key
            hash_key = generate_secure_hash()

            # Create transaction
            transaction = Transaction(
                trade_request_id=request1.id,
                initiator_id=request1.user_id,
                recipient_id=request2.user_id,
                item_sent=request1.item.name,
                item_received=request2.item.name,
                transaction_cost=item1_cost + item2_cost,
                status="PENDING",
                hash_key=hash_key,
            )

            self.db.add(transaction)
            self.db.commit()

            # Update trade request statuses
            request1.status = "MATCHED"
            request2.status = "MATCHED"
            self.db.commit()

            return transaction

        except Exception as e:
            self.logger.error(f"Error creating cross-trade: {e}")
            self.db.rollback()
            return None

    def validate_transaction_hash(self, hash_key: str) -> bool:
        """
        Validate the transaction hash key.

        Args:
            hash_key (str): Hash key to validate

        Returns:
            bool: True if hash is valid, False otherwise
        """
        transaction = self.db.query(Transaction).filter_by(hash_key=hash_key).first()
        return transaction is not None and transaction.status == "PENDING"

    def complete_transaction(self, hash_key: str) -> bool:
        """
        Complete a pending transaction.

        Args:
            hash_key (str): Hash key of the transaction

        Returns:
            bool: True if transaction completed successfully, False otherwise
        """
        try:
            transaction = (
                self.db.query(Transaction).filter_by(hash_key=hash_key).first()
            )

            if not transaction or transaction.status != "PENDING":
                return False

            # Update transaction status and mark completion time
            transaction.status = "COMPLETED"
            transaction.completed_at = datetime.utcnow()

            # Update associated items and trade requests
            trade_request = self.db.query(TradeRequest).get(
                transaction.trade_request_id
            )
            trade_request.status = "COMPLETED"

            # Adjust item quantities
            initiator_item = (
                self.db.query(Item).filter_by(name=transaction.item_sent).first()
            )
            recipient_item = (
                self.db.query(Item).filter_by(name=transaction.item_received).first()
            )

            if initiator_item and recipient_item:
                initiator_item.quantity -= trade_request.requested_quantity
                recipient_item.quantity += trade_request.requested_quantity

                if initiator_item.quantity <= 0:
                    initiator_item.is_available = False

            self.db.commit()
            return True

        except Exception as e:
            self.logger.error(f"Error completing transaction: {e}")
            self.db.rollback()
            return False
