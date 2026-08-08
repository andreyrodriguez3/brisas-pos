import { Global, Module } from '@nestjs/common';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaInterceptor } from './auditoria.interceptor';
import { AuditoriaService } from './auditoria.service';

@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [AuditoriaService, AuditoriaInterceptor],
  exports: [AuditoriaService, AuditoriaInterceptor],
})
export class AuditoriaModule {}
