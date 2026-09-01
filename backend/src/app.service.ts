import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'clases-espejo-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
