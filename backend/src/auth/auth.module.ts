import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TotpService } from './totp.service';
import { validarSecretoJwt } from '../common/jwt-secret';

// Sin secreto no se arranca: un valor por defecto permitiría forjar tokens.
const jwtSecret = validarSecretoJwt(process.env.JWT_SECRET);

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: jwtSecret,
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1d') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TotpService, JwtAuthGuard],
  exports: [AuthService, TotpService, JwtAuthGuard],
})
export class AuthModule {}
