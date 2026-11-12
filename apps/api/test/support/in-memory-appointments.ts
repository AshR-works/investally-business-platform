import { Page } from '../../src/shared-kernel';
import { Appointment, AppointmentStatus } from '../../src/modules/business-development/domain/appointment';
import { AppointmentListItem, AppointmentListQuery, AppointmentRepository } from '../../src/modules/business-development/domain/appointment-repository';
import { Company } from '../../src/modules/business-development/domain/company';
import { Contact } from '../../src/modules/business-development/domain/contact';
import { Offer } from '../../src/modules/business-development/domain/offer';
import { Opportunity } from '../../src/modules/business-development/domain/opportunity';

/** Dépôt de rendez-vous en mémoire ; il lit entreprises, contacts et offres pour appliquer la portée comme le fait la base. */
export class InMemoryAppointments implements AppointmentRepository {
  readonly items: Appointment[] = [];
  constructor(
    private readonly companies: { items: Company[] },
    private readonly contacts: { items: Contact[] } = { items: [] },
    private readonly offers: { items: Offer[] } = { items: [] },
    private readonly opportunities: { items: Opportunity[] } = { items: [] },
  ) {}

  async save(appointment: Appointment) {
    if (!this.items.includes(appointment)) this.items.push(appointment);
  }
  async findById(id: string) {
    return this.items.find((a) => a.id === id) ?? null;
  }
  private item(appointment: Appointment): AppointmentListItem {
    const contact = this.contacts.items.find((c) => c.id === appointment.contactId);
    return {
      appointment,
      companyName: this.companies.items.find((c) => c.id === appointment.companyId)!.name.value,
      contactName: contact ? `${contact.firstName} ${contact.lastName}` : null,
      offerReference: this.offers.items.find((o) => o.id === appointment.offerId)?.reference ?? null,
      opportunityTitle: this.opportunities.items.find((o) => o.id === appointment.opportunityId)?.title ?? null,
    };
  }
  async findConflicts(q: { organizerUserId: string; startsAt: Date; endsAt: Date; excludeId?: string }) {
    return this.items
      .filter((a) => a.organizerUserId === q.organizerUserId && a.status === AppointmentStatus.Planned && a.id !== q.excludeId && a.overlaps({ startsAt: q.startsAt, endsAt: q.endsAt }))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .map((a) => this.item(a));
  }
  async list(q: AppointmentListQuery): Promise<Page<AppointmentListItem>> {
    const rows = this.items
      .filter((a) => a.startsAt >= q.from && a.startsAt < q.to)
      .filter((a) => q.types.includes(a.type))
      .filter((a) => !q.status || a.status === q.status)
      .filter((a) => !q.companyId || a.companyId === q.companyId)
      .filter((a) => !q.offerId || a.offerId === q.offerId)
      .filter((a) => !q.ownerIds || q.ownerIds.includes(this.companies.items.find((c) => c.id === a.companyId)?.ownerUserId ?? ''))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime());
    return { items: rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map((a) => this.item(a)), total: rows.length, page: q.page, pageSize: q.pageSize };
  }
}
