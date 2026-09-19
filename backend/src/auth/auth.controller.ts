import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('activate')
  validarToken(@Query('token') token?: string) {
    // Sin token, Prisma lanzaría un error de validación (500) en vez de un 400.
    if (!token?.trim()) {
      throw new BadRequestException(
        'Falta el token de invitación: abre el enlace completo del correo.',
      );
    }
    return this.authService.validarTokenInvitacion(token);
  }

  @Post('activate')
  @UseGuards(RateLimitGuard)
  activarCuenta(@Body() dto: ActivateAccountDto) {
    return this.authService.activarCuenta(dto);
  }
}
