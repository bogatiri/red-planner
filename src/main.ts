import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import * as cookieParser from 'cookie-parser'
import * as express from 'express'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	app.setGlobalPrefix('api')
	app.use('/static/uploads', express.static('uploads'));
	app.use(cookieParser())
	app.enableCors({
		origin: ['http://192.168.0.7:3000'],
		credentials: true,
		exposedHeaders: 'set-cookie'
	})

	await app.listen(4201)
}
bootstrap()
