
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // `passwordHash` nunca debe salir en una respuesta: se omite en el cliente
    // para que `include: { usuario: true }` devuelva el usuario sin el hash.
    super({ omit: { usuario: { passwordHash: true } } });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}