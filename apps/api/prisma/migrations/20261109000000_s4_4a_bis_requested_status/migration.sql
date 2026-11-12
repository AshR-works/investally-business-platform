-- S4.4a-bis : état « demandé » des agréments (D41, FD-4). La valeur est ajoutée seule : elle ne peut servir qu'après validation de cette
-- transaction ; les contraintes qui l'emploient sont dans la migration suivante.

-- AlterEnum
ALTER TYPE "bd"."ApprovalStatus" ADD VALUE IF NOT EXISTS 'REQUESTED' BEFORE 'RECEIVED';
