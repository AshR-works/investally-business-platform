# Référence des routes de l’API

*Générée depuis la description OpenAPI réelle (`docs/api/openapi.json`) par `scripts/api-docs/build-postman.mjs` : ne pas modifier à la main.*

## admin

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/admin/exports/{kind}` | Télécharger un export d’administration (CSV) | `iam.export.read` + step-up | 200 |
| GET | `/admin/roles` |  | `iam.role.read` | 200 |
| GET | `/admin/users` |  | `iam.user.read` | 200 |
| POST | `/admin/users` |  | `iam.user.create` + step-up | 201 |
| GET | `/admin/users/{id}` |  | `iam.user.read` | 200 |
| PATCH | `/admin/users/{id}` |  | `iam.user.update` | 200 |
| POST | `/admin/users/{id}/disable` |  | `iam.user.disable` + step-up | 200 |
| POST | `/admin/users/{id}/enable` |  | `iam.user.disable` + step-up | 200 |
| POST | `/admin/users/{id}/invitations` |  | `iam.user.create` | 200 |
| POST | `/admin/users/{id}/mfa/reset` |  | `iam.user.reset_mfa` + step-up | 204 |
| POST | `/admin/users/{id}/password-reset` |  | `iam.user.reset_password` + step-up | 200 |
| PUT | `/admin/users/{id}/roles` |  | `iam.user.assign_role` + step-up | 200 |
| POST | `/admin/users/{id}/sessions/revoke` |  | `iam.session.revoke` + step-up | 200 |

## ambassadors

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/ambassadors` |  | `bd.ambassador.read` | 200 |
| POST | `/ambassadors` |  | `bd.ambassador.create` | 201 |
| GET | `/ambassadors/{id}` |  | `bd.ambassador.read` | 200 |
| PUT | `/ambassadors/{id}` |  | `bd.ambassador.update` | 200 |
| POST | `/ambassadors/{id}/status` |  | `bd.ambassador.update` | 200 |

## appointments

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/appointments` |  | `bd.appointment.read` | 200 |
| POST | `/appointments` |  | `bd.appointment.create` | 201 |
| GET | `/appointments/{id}` |  | `bd.appointment.read` | 200 |
| PUT | `/appointments/{id}` |  | `bd.appointment.update` | 200 |
| POST | `/appointments/{id}/cancel` |  | `bd.appointment.cancel` | 200 |
| POST | `/appointments/{id}/hold` |  | `bd.appointment.update` | 200 |
| POST | `/appointments/{id}/postpone` |  | `bd.appointment.update` | 200 |

## approvals

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/approvals` |  | `bd.approval.read` | 200 |
| POST | `/approvals` |  | `bd.approval.create` | 201 |
| GET | `/approvals/{id}` |  | `bd.approval.read` | 200 |
| POST | `/approvals/{id}/cancel` |  | `bd.approval.cancel` | 200 |
| POST | `/approvals/{id}/expire` |  | `bd.approval.cancel` | 200 |
| POST | `/approvals/{id}/honor` |  | `bd.approval.honor` | 200 |
| POST | `/approvals/{id}/receive` |  | `bd.approval.create` | 200 |

## auth

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| POST | `/auth/change-password` |  | authentifié | 204 |
| POST | `/auth/invitation/accept` |  | publique | 204 |
| POST | `/auth/login` |  | publique | 200 |
| POST | `/auth/logout` |  | authentifié | 204 |
| GET | `/auth/me` |  | authentifié | 200 |
| GET | `/auth/me/profile` |  | authentifié | 200 |
| POST | `/auth/mfa/enroll/confirm` |  | authentifié | 200 |
| POST | `/auth/mfa/enroll/start` |  | authentifié | 200 |
| POST | `/auth/mfa/recovery-codes/regenerate` |  | authentifié | 200 |
| POST | `/auth/mfa/verify` |  | authentifié | 200 |
| POST | `/auth/password-reset/accept` |  | publique | 204 |
| POST | `/auth/password-reset/request` |  | publique | 202 |
| POST | `/auth/refresh` |  | publique | 200 |
| GET | `/auth/sessions` |  | `iam.session.read` | 200 |
| DELETE | `/auth/sessions/{id}` |  | `iam.session.revoke` | 204 |
| GET | `/auth/sessions/history` |  | `iam.session.read` | 200 |
| POST | `/auth/sessions/revoke-others` |  | `iam.session.revoke` + step-up | 200 |

## commissions

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/commissions` |  | `bd.commission.read` | 200 |
| GET | `/commissions/{id}` |  | `bd.commission.read` | 200 |
| POST | `/commissions/{id}/amount` |  | `bd.commission.manage` | 200 |
| POST | `/commissions/{id}/cancel` |  | `bd.commission.manage` | 200 |
| POST | `/commissions/{id}/hold` |  | `bd.commission.release` | 200 |
| POST | `/commissions/{id}/pay` |  | `bd.commission.pay` | 200 |
| POST | `/commissions/{id}/release` |  | `bd.commission.release` | 200 |

## companies

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/companies` |  | `bd.company.read` | 200 |
| POST | `/companies` |  | `bd.company.create` | 201 |
| GET | `/companies/{id}` |  | `bd.company.read` | 200 |
| PUT | `/companies/{id}` |  | `bd.company.update` | 200 |
| GET | `/companies/{id}/export` |  | `bd.company.read` | 200 |
| POST | `/companies/{id}/owner` |  | `bd.company.reassign` + step-up | 200 |
| POST | `/companies/{id}/status` |  | `bd.company.update` | 200 |
| GET | `/companies/overview` |  | `bd.company.read` | 200 |
| GET | `/companies/owners` |  | `bd.company.reassign` | 200 |

## contacts

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/contacts` |  | `bd.contact.read` | 200 |
| POST | `/contacts` |  | `bd.contact.create` | 201 |
| DELETE | `/contacts/{id}` |  | `bd.contact.delete` | 204 |
| GET | `/contacts/{id}` |  | `bd.contact.read` | 200 |
| PUT | `/contacts/{id}` |  | `bd.contact.update` | 200 |

## documents

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/documents` |  | `docs.document.read` | 200 |
| POST | `/documents` |  | `docs.document.create` | 201 |
| GET | `/documents/{id}` |  | `docs.document.read` | 200 |
| POST | `/documents/{id}/archive` |  | `docs.document.delete` | 204 |
| GET | `/documents/{id}/download` |  | `docs.document.download` | 200 |
| POST | `/documents/{id}/versions` |  | `docs.document.create` | 201 |
| GET | `/documents/meta` |  | `docs.document.read` | 200 |

## enrollments

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/enrollments` |  | `training.enrollment.read` | 200 |
| POST | `/enrollments` |  | `training.enrollment.create` | 201 |
| GET | `/enrollments/{id}` |  | `training.enrollment.read` | 200 |
| POST | `/enrollments/{id}/cancel` |  | `training.enrollment.cancel` | 200 |
| POST | `/enrollments/{id}/confirm` |  | `training.enrollment.update` | 200 |
| POST | `/enrollments/{id}/replace` |  | `training.enrollment.cancel` | 201 |
| GET | `/enrollments/approval-options` |  | `training.enrollment.create` | 200 |

## facilitators

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/facilitators` |  | `bd.facilitator.read` | 200 |
| POST | `/facilitators` |  | `bd.facilitator.create` | 201 |
| GET | `/facilitators/{id}` |  | `bd.facilitator.read` | 200 |

## followups

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/followups` |  | `bd.followup.read` | 200 |
| POST | `/followups` |  | `bd.followup.create` | 201 |
| GET | `/followups/{id}` |  | `bd.followup.read` | 200 |
| PUT | `/followups/{id}` |  | `bd.followup.update` | 200 |
| POST | `/followups/{id}/cancel` |  | `bd.followup.update` | 200 |
| POST | `/followups/{id}/complete` |  | `bd.followup.complete` | 200 |

## Health

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/health/live` |  | publique | 200 |
| GET | `/health/ready` |  | publique | 200 |

## hr

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/hr/contracts` |  | `hr.contract.read` | 200 |
| POST | `/hr/contracts` |  | `hr.contract.manage` | 201 |
| GET | `/hr/contracts/{id}` |  | `hr.contract.read` | 200 |
| PUT | `/hr/contracts/{id}` |  | `hr.contract.manage` | 200 |
| POST | `/hr/contracts/{id}/end` |  | `hr.contract.manage` | 200 |
| GET | `/hr/contracts/deadlines` |  | `hr.contract.read` | 200 |
| GET | `/hr/contracts/types` |  | `hr.contract.read` | 200 |
| POST | `/hr/contracts/types` |  | `hr.contract.manage` | 201 |
| PUT | `/hr/contracts/types/{id}` |  | `hr.contract.manage` | 200 |
| GET | `/hr/directory` |  | `hr.directory.read` | 200 |
| GET | `/hr/employees` |  | `hr.employee.read` | 200 |
| POST | `/hr/employees` |  | `hr.employee.create` | 201 |
| GET | `/hr/employees/{id}` |  | `hr.employee.read` | 200 |
| PUT | `/hr/employees/{id}` |  | `hr.employee.update` | 200 |
| POST | `/hr/employees/{id}/status` |  | `hr.employee.archive` | 200 |
| GET | `/hr/employees/hierarchy-gaps` |  | `hr.employee.read` | 200 |
| GET | `/hr/journeys` |  | `hr.journey.read` | 200 |
| POST | `/hr/journeys` |  | `hr.journey.manage` | 201 |
| GET | `/hr/journeys/{id}` |  | `hr.journey.read` | 200 |
| POST | `/hr/journeys/{id}/cancel` |  | `hr.journey.manage` | 200 |
| POST | `/hr/journeys/{id}/tasks/{taskId}/complete` |  | `hr.journey.manage` | 200 |
| POST | `/hr/journeys/{id}/tasks/{taskId}/reopen` |  | `hr.journey.manage` | 200 |
| GET | `/hr/journeys/templates` |  | `hr.journey.read` | 200 |
| PUT | `/hr/journeys/templates/{kind}` |  | `hr.journey.manage` | 200 |
| GET | `/hr/leave/adjustments` |  | `hr.leave.manage` | 200 |
| POST | `/hr/leave/adjustments` |  | `hr.leave.manage` | 201 |
| GET | `/hr/leave/balance` |  | `hr.leave.read` | 200 |
| GET | `/hr/leave/calendar` |  | `hr.leave.read` | 200 |
| GET | `/hr/leave/holidays` |  | `hr.leave.read` | 200 |
| POST | `/hr/leave/holidays` |  | `hr.leave.manage` | 201 |
| DELETE | `/hr/leave/holidays/{id}` |  | `hr.leave.manage` | 204 |
| GET | `/hr/leave/requests` |  | `hr.leave.read` | 200 |
| POST | `/hr/leave/requests` |  | `hr.leave.create` | 201 |
| GET | `/hr/leave/requests/{id}` |  | `hr.leave.read` | 200 |
| POST | `/hr/leave/requests/{id}/cancel` |  | `hr.leave.read` | 200 |
| POST | `/hr/leave/requests/{id}/decision` |  | `hr.leave.approve` | 200 |
| GET | `/hr/leave/settings` |  | `hr.leave.read` | 200 |
| PUT | `/hr/leave/settings` |  | `hr.leave.manage` | 200 |
| GET | `/hr/leave/types` |  | `hr.leave.read` | 200 |
| POST | `/hr/leave/types` |  | `hr.leave.manage` | 201 |
| PUT | `/hr/leave/types/{id}` |  | `hr.leave.manage` | 200 |
| GET | `/hr/linkable-users` |  | `hr.employee.update` | 200 |
| GET | `/hr/org-chart` |  | `hr.directory.read` | 200 |

## learners

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/learners` |  | `training.learner.read` | 200 |
| POST | `/learners` |  | `training.learner.create` | 201 |
| DELETE | `/learners/{id}` |  | `training.learner.delete` | 204 |
| GET | `/learners/{id}` |  | `training.learner.read` | 200 |
| PUT | `/learners/{id}` |  | `training.learner.update` | 200 |

## modules

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/modules` |  | `training.training.read` | 200 |
| POST | `/modules` |  | `training.training.create` | 201 |
| GET | `/modules/{id}` |  | `training.training.read` | 200 |
| PUT | `/modules/{id}` |  | `training.training.update` | 200 |
| POST | `/modules/{id}/status` |  | `training.training.update` | 200 |

## offers

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/offers` |  | `bd.offer.read` | 200 |
| POST | `/offers` |  | `bd.offer.create` | 201 |
| GET | `/offers/{id}` |  | `bd.offer.read` | 200 |
| PUT | `/offers/{id}` |  | `bd.offer.update` | 200 |
| POST | `/offers/{id}/accept` |  | `bd.offer.update` | 200 |
| POST | `/offers/{id}/clone` |  | `bd.offer.create` | 201 |
| GET | `/offers/{id}/export` |  | `bd.offer.read` | 200 |
| POST | `/offers/{id}/refuse` |  | `bd.offer.update` | 200 |
| POST | `/offers/{id}/submit` |  | `bd.offer.update` | 200 |
| POST | `/offers/{id}/withdraw` |  | `bd.offer.withdraw` | 200 |

## opportunities

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/opportunities` |  | `bd.opportunity.read` | 200 |
| POST | `/opportunities` |  | `bd.opportunity.create` | 201 |
| GET | `/opportunities/{id}` |  | `bd.opportunity.read` | 200 |
| PUT | `/opportunities/{id}` |  | `bd.opportunity.update` | 200 |
| POST | `/opportunities/{id}/advance` |  | `bd.opportunity.advance` | 200 |
| POST | `/opportunities/{id}/close-lost` |  | `bd.opportunity.close_lost` | 200 |
| POST | `/opportunities/{id}/close-won` |  | `bd.opportunity.close_won` | 200 |
| POST | `/opportunities/{id}/waiver` |  | `bd.opportunity.override` | 200 |

## programs

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/programs` |  | `training.program.read` | 200 |
| POST | `/programs` |  | `training.program.create` | 201 |
| GET | `/programs/{id}` |  | `training.program.read` | 200 |
| PUT | `/programs/{id}` |  | `training.program.update` | 200 |
| POST | `/programs/{id}/status` |  | `training.program.archive` | 200 |

## receipts

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/receipts` |  | `bd.receipt.read` | 200 |
| POST | `/receipts` |  | `bd.receipt.create` | 201 |
| GET | `/receipts/{id}` |  | `bd.receipt.read` | 200 |
| POST | `/receipts/{id}/cancel` |  | `bd.receipt.update` | 200 |

## rhythms

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/rhythms` |  | `training.program.read` | 200 |

## rooms

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/rooms` |  | `training.room.read` | 200 |
| POST | `/rooms` |  | `training.room.manage` | 201 |
| GET | `/rooms/{id}` |  | `training.room.read` | 200 |
| PUT | `/rooms/{id}` |  | `training.room.manage` | 200 |
| POST | `/rooms/{id}/status` |  | `training.room.manage` | 200 |

## sessions

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/sessions` |  | `training.session.read` | 200 |
| POST | `/sessions` |  | `training.session.create` | 201 |
| GET | `/sessions/{id}` |  | `training.session.read` | 200 |
| PUT | `/sessions/{id}` |  | `training.session.update` | 200 |
| POST | `/sessions/{id}/cancel` |  | `training.session.cancel` | 200 |
| POST | `/sessions/{id}/open` |  | `training.session.update` | 200 |
| POST | `/sessions/{id}/postpone` |  | `training.session.update` | 200 |

## trainers

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/trainers` |  | `training.trainer.read` | 200 |
| POST | `/trainers` |  | `training.trainer.manage` | 201 |
| GET | `/trainers/{id}` |  | `training.trainer.read` | 200 |
| PUT | `/trainers/{id}` |  | `training.trainer.manage` | 200 |
| POST | `/trainers/{id}/status` |  | `training.trainer.manage` | 200 |

## trainings

| Méthode | Chemin | Résumé | Permission | Succès |
|---|---|---|---|---|
| GET | `/trainings` |  | `training.training.read` | 200 |
| POST | `/trainings` |  | `training.training.create` | 201 |
| GET | `/trainings/{id}` |  | `training.training.read` | 200 |
| PUT | `/trainings/{id}` |  | `training.training.update` | 200 |
| POST | `/trainings/{id}/status` |  | `training.training.update` | 200 |

*198 routes.*
