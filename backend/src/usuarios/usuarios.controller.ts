import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser('sub') usuarioId: number) {
    return this.usuariosService.getPerfil(usuarioId);
  }
}
