import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
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
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
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
