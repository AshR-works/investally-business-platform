import { Page } from '../../src/shared-kernel';
import { Company } from '../../src/modules/business-development/domain/company';
import { Contact, ContactRole } from '../../src/modules/business-development/domain/contact';
import { ContactListItem, ContactRepository } from '../../src/modules/business-development/domain/contact-repository';

/** Dépôt de contacts en mémoire ; il lit les entreprises pour appliquer la portée comme le fait la base. */
export class InMemoryContacts implements ContactRepository {
  readonly items: Contact[] = [];
  private readonly removed = new Set<string>();
  constructor(private readonly companies: { items: Company[] }) {}

  async save(contact: Contact) {
    if (!this.items.includes(contact)) this.items.push(contact);
  }
  async findById(id: string) {
    return this.items.find((c) => c.id === id && !this.removed.has(c.id)) ?? null;
  }
  async remove(id: string) {
    this.removed.add(id);
  }
  private alive() {
    return this.items.filter((c) => !this.removed.has(c.id));
  }
  async findDuplicates(q: { companyId: string; nameKey: string; emailKey: string | null; excludeId?: string }) {
    return this.alive().filter((c) => c.companyId === q.companyId && c.id !== q.excludeId && (c.nameKey === q.nameKey || (q.emailKey !== null && c.emailKey === q.emailKey)));
  }
  async list(q: { page: number; pageSize: number; search?: string; companyId?: string; role?: ContactRole; ownerIds?: readonly string[] }): Promise<Page<ContactListItem>> {
    const rows = this.alive()
      .map((contact) => ({ contact, company: this.companies.items.find((c) => c.id === contact.companyId)! }))
      .filter((r) => !q.ownerIds || q.ownerIds.includes(r.company.ownerUserId ?? ''))
      .filter((r) => !q.companyId || r.contact.companyId === q.companyId)
      .filter((r) => !q.role || r.contact.role === q.role)
      .filter((r) => !q.search || `${r.contact.firstName} ${r.contact.lastName} ${r.contact.email ?? ''}`.toLowerCase().includes(q.search.toLowerCase()));
    const items = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((r) => ({ contact: r.contact, companyName: r.company.name.value }));
    return { items, total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
