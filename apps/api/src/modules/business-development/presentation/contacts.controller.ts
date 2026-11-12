import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { Access, CurrentActor, Protected, visibilityFor } from '../../iam';
import type { AccessContext, AuthenticatedActor } from '../../iam';
import { DeleteContactUseCase, GetContactHandler, ListContactsHandler, RegisterContactUseCase, UpdateContactUseCase } from '../application/contact-use-cases';
import { ListContactsDto, RegisterContactDto, UpdateContactDto } from './dto/contact.dto';

/**
 * Contacts des entreprises. Chaque route est protégée (identité + MFA + permission) ; la PORTÉE est celle de l'entreprise du
 * contact : hors portée, un contact (ou son entreprise) est « introuvable », jamais « interdit ».
 */
@ApiTags('contacts')
@Controller('contacts')
export class ContactsController {
  constructor(
    private readonly registerContact: RegisterContactUseCase,
    private readonly updateContact: UpdateContactUseCase,
    private readonly deleteContact: DeleteContactUseCase,
    private readonly getContact: GetContactHandler,
    private readonly listContacts: ListContactsHandler,
  ) {}

  @Post()
  @HttpCode(201)
  @Protected('bd.contact.create')
  register(@Body() dto: RegisterContactDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.registerContact.execute({ ...dto, access, actor: actorContextFrom(req, actor) });
  }

  @Get()
  @Protected('bd.contact.read')
  list(@Query() query: ListContactsDto, @Access() access: AccessContext) {
    return this.listContacts.execute({ ...query, access, visibility: visibilityFor(access, 'bd.contact.read') });
  }

  @Get(':id')
  @Protected('bd.contact.read')
  get(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext) {
    return this.getContact.execute({ id, access });
  }

  @Put(':id')
  @Protected('bd.contact.update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.updateContact.execute({ ...dto, id, access, actor: actorContextFrom(req, actor) });
  }

  @Delete(':id')
  @HttpCode(204)
  @Protected('bd.contact.delete')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Access() access: AccessContext, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    await this.deleteContact.execute({ id, access, actor: actorContextFrom(req, actor) });
  }
}
