import 'dotenv/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(() => {
    service = new PrismaService();
  });

  afterAll(async () => {
    await service.$disconnect();
  });

  it('should be defined and expose prisma methods', () => {
    expect(service).toBeDefined();
    expect(service.$connect).toBeDefined();
    expect(service.$disconnect).toBeDefined();
    expect(service.usuario).toBeDefined();
  });
});
