import { Injectable } from '@nestjs/common';

/**
 * Application service providing basic health responses.
 */
@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
