import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { RecuperarPasswordDto } from './dto/recuperar-password.dto';
import { RestablecerPasswordDto } from './dto/restablecer-password.dto';
import { CambiarCorreoDto } from './dto/cambiar-correo.dto';
import { VerificarTotpDto } from './dto/verificar-totp.dto';
import { ConfirmarTotpDto } from './dto/confirmar-totp.dto';
import { DesactivarTotpDto } from './dto/desactivar-totp.dto';
import { TotpService } from './totp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
  ) {}

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

  /** Segundo paso del login cuando la cuenta tiene TOTP habilitado. */
  @Post('totp/verificar')
  @UseGuards(RateLimitGuard)
  verificarTotp(@Body() dto: VerificarTotpDto) {
    return this.authService.verificarTotp(dto);
  }

  /** Estado del segundo factor de la cuenta CACE. */
  @Get('totp/estado')
  @UseGuards(JwtAuthGuard)
  estadoTotp(@CurrentUser('sub') usuarioId: number) {
    return this.totpService.estado(usuarioId);
  }

  /** Inicia la configuración y entrega el QR una sola vez. */
  @Post('totp/iniciar')
  @UseGuards(JwtAuthGuard)
  iniciarTotp(@CurrentUser('sub') usuarioId: number) {
    return this.totpService.iniciar(usuarioId);
  }

  /** Confirma el primer código y entrega los códigos de recuperación. */
  @Post('totp/confirmar')
  @UseGuards(JwtAuthGuard)
  confirmarTotp(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: ConfirmarTotpDto,
  ) {
    return this.totpService.confirmar(usuarioId, dto.codigo);
  }

  /** Desactiva el segundo factor con contraseña y código. */
  @Post('totp/desactivar')
  @UseGuards(JwtAuthGuard)
  desactivarTotp(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: DesactivarTotpDto,
  ) {
    return this.totpService.desactivar(usuarioId, dto.password, dto.codigo);
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

  /** Confirma el correo con el enlace (registro o cambio de dirección). */
  @Get('confirmar-correo')
  confirmarCorreo(@Query('token') token?: string) {
    if (!token?.trim()) {
      throw new BadRequestException(
        'Falta el código del enlace de confirmación.',
      );
    }
    return this.authService.confirmarCorreo(token);
  }

  /** Reenvía el enlace de confirmación a una cuenta sin confirmar. */
  @Post('confirmar-correo/reenviar')
  @UseGuards(RateLimitGuard)
  reenviarConfirmacion(
    @Body() dto: RecuperarPasswordDto,
    @Req() peticion: Request,
  ) {
    return this.authService.reenviarVerificacionCorreo(dto.correo, peticion);
  }

  /**
   * Deja constancia de que la cuenta aceptó la versión vigente del aviso.
   * Hace falta para las cuentas creadas antes de que existiera esta versión.
   */
  @Post('aceptar-aviso')
  @UseGuards(JwtAuthGuard)
  aceptarAviso(@CurrentUser('sub') usuarioId: number) {
    return this.authService.aceptarAviso(usuarioId);
  }

  /** Pide cambiar el correo de la cuenta (se confirma en la dirección nueva). */
  @Put('correo')
  @UseGuards(JwtAuthGuard)
  cambiarCorreo(
    @CurrentUser('sub') usuarioId: number,
    @Body() dto: CambiarCorreoDto,
    @Req() peticion: Request,
  ) {
    return this.authService.solicitarCambioCorreo(
      usuarioId,
      dto.correo,
      peticion,
    );
  }
}
