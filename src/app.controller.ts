import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Basic controller exposing the application health endpoint.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
