import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { actorContextFrom } from '../../../shared-kernel';
import { CurrentActor, Protected } from '../../iam';
import type { AuthenticatedActor } from '../../iam';
import {
  ChangeModuleStatusUseCase, ChangeProgramStatusUseCase, ChangeRoomStatusUseCase, ChangeTrainerStatusUseCase, ChangeTrainingStatusUseCase, CreateModuleUseCase, CreateProgramUseCase, CreateRoomUseCase,
  CreateTrainerUseCase, CreateTrainingUseCase, GetModuleHandler, GetProgramHandler, GetRoomHandler, GetTrainerHandler, GetTrainingHandler, ListModulesHandler, ListProgramsHandler, ListRhythmsHandler,
  ListRoomsHandler, ListTrainersHandler, ListTrainingsHandler, UpdateModuleUseCase, UpdateProgramUseCase, UpdateRoomUseCase, UpdateTrainerUseCase, UpdateTrainingUseCase,
} from '../application/catalogue-use-cases';
import {
  ChangeCatalogueStatusDto, CreateModuleDto, CreateProgramDto, CreateRoomDto, CreateTrainerDto, CreateTrainingDto, ListCatalogueDto, ListTrainingsDto, UpdateModuleDto, UpdateProgramDto,
  UpdateRoomDto, UpdateTrainerDto, UpdateTrainingDto,
} from './dto/catalogue.dto';

/*
 * Catalogue Investudy. Référentiel PARTAGÉ, sans propriétaire : la permission du module suffit (portée « Tous » pour tous les rôles qui la
 * détiennent) ; il n'y a donc pas de contrôle par objet. Le contrat anti-IDOR les classe « référentiel » et vérifie cette portée.
 */

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly create: CreateProgramUseCase,
    private readonly update: UpdateProgramUseCase,
    private readonly changeStatus: ChangeProgramStatusUseCase,
    private readonly getOne: GetProgramHandler,
    private readonly listAll: ListProgramsHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.program.create')
  register(@Body() dto: CreateProgramDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.create.execute({ ...dto, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.program.read')
  list(@Query() query: ListCatalogueDto) {
    return this.listAll.execute(query);
  }

  @Get(':id') @Protected('training.program.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOne.execute({ id });
  }

  @Put(':id') @Protected('training.program.update')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProgramDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  /** Archiver ou réactiver un programme. */
  @Post(':id/status') @HttpCode(200) @Protected('training.program.archive')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeCatalogueStatusDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.changeStatus.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }
}

@ApiTags('trainings')
@Controller('trainings')
export class TrainingsController {
  constructor(
    private readonly create: CreateTrainingUseCase,
    private readonly update: UpdateTrainingUseCase,
    private readonly changeStatus: ChangeTrainingStatusUseCase,
    private readonly getOne: GetTrainingHandler,
    private readonly listAll: ListTrainingsHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.training.create')
  register(@Body() dto: CreateTrainingDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.create.execute({ ...dto, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.training.read')
  list(@Query() query: ListTrainingsDto) {
    return this.listAll.execute(query);
  }

  @Get(':id') @Protected('training.training.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOne.execute({ id });
  }

  @Put(':id') @Protected('training.training.update')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrainingDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  /** Archiver ou réactiver (droit de modification : le catalogue n'a pas de droit de suppression, D46). */
  @Post(':id/status') @HttpCode(200) @Protected('training.training.update')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeCatalogueStatusDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.changeStatus.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }
}

@ApiTags('rooms')
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly create: CreateRoomUseCase,
    private readonly update: UpdateRoomUseCase,
    private readonly changeStatus: ChangeRoomStatusUseCase,
    private readonly getOne: GetRoomHandler,
    private readonly listAll: ListRoomsHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.room.manage')
  register(@Body() dto: CreateRoomDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.create.execute({ ...dto, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.room.read')
  list(@Query() query: ListCatalogueDto) {
    return this.listAll.execute(query);
  }

  @Get(':id') @Protected('training.room.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOne.execute({ id });
  }

  @Put(':id') @Protected('training.room.manage')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoomDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/status') @HttpCode(200) @Protected('training.room.manage')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeCatalogueStatusDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.changeStatus.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }
}

@ApiTags('trainers')
@Controller('trainers')
export class TrainersController {
  constructor(
    private readonly create: CreateTrainerUseCase,
    private readonly update: UpdateTrainerUseCase,
    private readonly changeStatus: ChangeTrainerStatusUseCase,
    private readonly getOne: GetTrainerHandler,
    private readonly listAll: ListTrainersHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.trainer.manage')
  register(@Body() dto: CreateTrainerDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.create.execute({ ...dto, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.trainer.read')
  list(@Query() query: ListCatalogueDto) {
    return this.listAll.execute(query);
  }

  @Get(':id') @Protected('training.trainer.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOne.execute({ id });
  }

  @Put(':id') @Protected('training.trainer.manage')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTrainerDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/status') @HttpCode(200) @Protected('training.trainer.manage')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeCatalogueStatusDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.changeStatus.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }
}

/** Modules : chapitres partagés entre certificats. Mêmes droits que les certificats. */
@ApiTags('modules')
@Controller('modules')
export class ModulesController {
  constructor(
    private readonly create: CreateModuleUseCase,
    private readonly update: UpdateModuleUseCase,
    private readonly changeStatus: ChangeModuleStatusUseCase,
    private readonly getOne: GetModuleHandler,
    private readonly listAll: ListModulesHandler,
  ) {}

  @Post() @HttpCode(201) @Protected('training.training.create')
  register(@Body() dto: CreateModuleDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.create.execute({ ...dto, actor: actorContextFrom(req, actor) });
  }

  @Get() @Protected('training.training.read')
  list(@Query() query: ListCatalogueDto) {
    return this.listAll.execute(query);
  }

  @Get(':id') @Protected('training.training.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getOne.execute({ id });
  }

  @Put(':id') @Protected('training.training.update')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateModuleDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.update.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }

  @Post(':id/status') @HttpCode(200) @Protected('training.training.update')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeCatalogueStatusDto, @CurrentActor() actor: AuthenticatedActor, @Req() req: Request) {
    return this.changeStatus.execute({ ...dto, id, actor: actorContextFrom(req, actor) });
  }
}

/** Rythmes de session (jour, soir) : valeurs de référence en lecture seule. */
@ApiTags('rhythms')
@Controller('rhythms')
export class RhythmsController {
  constructor(private readonly listAll: ListRhythmsHandler) {}

  @Get() @Protected('training.program.read')
  list() {
    return this.listAll.execute();
  }
}
