import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { RecuperarPasswordDto } from './dto/recuperar-password.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto, @Req() peticion: Request) {
    // La petición hace falta para los correos: el enlace debe apuntar al dominio
    // o al túnel desde el que se está usando la aplicación.
    return this.authService.register(dto, peticion);
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

  /**
   * Pide el enlace de recuperación. Responde siempre lo mismo, exista o no la
   * cuenta, y va limitado para que no se pueda usar para inundar de correos.
   */
  @Post('recuperar')
  @UseGuards(RateLimitGuard)
  recuperar(@Body() dto: RecuperarPasswordDto, @Req() peticion: Request) {
    return this.authService.recuperarPassword(dto.correo, peticion);
  }

  /** Comprueba el enlace antes de enseñar el formulario de nueva contraseña. */
  @Get('recuperar/validar')
  validarRecuperacion(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException(
        'Falta el código del enlace de recuperación.',
      );
    }
    return this.authService.validarTokenRecuperacion(token);
  }

  /** Restablece la contraseña con el token del correo (un solo uso). */
  @Post('restablecer')
  @UseGuards(RateLimitGuard)
  restablecer(@Body() dto: RestablecerPasswordDto) {
    return this.authService.restablecerPassword(dto.token, dto.password);
  }
}
