import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InviteDocenteDto } from './dto/invite-docente.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('invitar-docente')
  @UseGuards(JwtAuthGuard)
  invitarDocente(@Req() req: any, @Body() dto: InviteDocenteDto) {
    return this.authService.invitarDocente(req.user.sub, dto);
  }

  @Get('activate')
  validarToken(@Query('token') token: string) {
    return this.authService.validarTokenInvitacion(token);
  }

  @Post('activate')
  activarCuenta(@Body() dto: ActivateAccountDto) {
    return this.authService.activarCuenta(dto);
  }
}
