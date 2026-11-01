import { DomainError } from '../../src/shared-kernel';
import { Receipt, ReceiptStatus } from '../../src/modules/business-development/domain/receipt';
import { ReceiptRepository } from '../../src/modules/business-development/domain/receipt-repository';

/** Dépôt de décharges en mémoire ; il refuse, comme l'index unique de la base, une seconde décharge valide pour la même offre. */
export class InMemoryReceipts implements ReceiptRepository {
  readonly items: Receipt[] = [];

  async save(receipt: Receipt) {
    if (this.items.includes(receipt)) return;
    if (receipt.status === ReceiptStatus.Valid && this.items.some((r) => r.offerId === receipt.offerId && r.status === ReceiptStatus.Valid)) {
      throw new DomainError('CONFLICT', 'Cette offre a déjà une décharge valide');
    }
    this.items.push(receipt);
  }
  async findById(id: string) {
    return this.items.find((r) => r.id === id) ?? null;
  }
  async listByOffer(offerId: string) {
    return this.items.filter((r) => r.offerId === offerId).reverse();
  }
}
