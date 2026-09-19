import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

// Sin secreto no se arranca: un valor por defecto permitiría forjar tokens.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  throw new Error(
    'Falta JWT_SECRET (o es demasiado corto): define la variable de entorno antes de arrancar.',
  );
}

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
