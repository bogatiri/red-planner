import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { CardDto, CardOrderUpdateDto, CardUpdate } from './card.dto'

@Injectable()
export class CardService {
	constructor(private prisma: PrismaService) {}

	async findByListId(id: string) {
		return this.prisma.card.findMany({
			where: {
				listId: id
			},
			orderBy: {
				order: 'asc'
			}
		})
	}

	async addUserToCard(email: string, boardId: string, cardId: string) {
		const user = await this.prisma.user.findUnique({
			where: { email: email },
			include: {
				boards: true,
				cards: true
			}
		})

		if (!user) {
			throw new Error(`User with email ${email} not found`)
		}

		const operations = []
		const boardExist = user.boards.some(board => board.id === boardId)
		const cardExist = user.cards.some(card => card.id === cardId)

		if (cardExist){
			throw new Error(`User already has this card`)
		}

		if (!boardExist) {
			operations.push(
					this.prisma.board.update({
						where: { id: boardId },
						data: {
							users: {
								connect: [{ id: user.id }]
							}
						}
					})
			)
		}

		if (!cardExist) {
			operations.push(
				this.prisma.card.update({
					where: { id: cardId },
					data: {
						users: {
							connect: [{ id: user.id }]
						}
					}
				}),
				this.prisma.user.update({
					where: { email: email },
					data: {
						boards: {
							connect: [{ id: boardId }]
						},
						cards: {
							connect: [{ id: cardId }]
						}
					}
				})
			)
		}

		if (!boardExist || !cardExist) {
			return await this.prisma.$transaction(operations)
		}
	}

	async getById(id: string) {
		return this.prisma.card.findUnique({
			where: {
				id
			},
			include: {
				users: true
			}
		})
	}

	async getAll(userId: string) {
		return this.prisma.card.findMany({
			where: {
				userId
			},
			include: {
				users: true
			}
		})
	}

	async create(dto: CardDto, userId: string, listId: string) {
		const currentMaxOrder = await this.prisma.card.count({
			where: { listId: listId }
		})

		return this.prisma.card.create({
			data: {
				...dto,
				list: {
					connect: {
						id: listId
					}
				},
				creator: {
					connect: {
						id: userId
					}
				},
				order: currentMaxOrder + 1,
			},
			include: {
				users: true
			}
		})
	}

	async copyCard(cardId: string, listId: string) {
		return await this.prisma.$transaction(async prisma => {
			const cardToCopy = await prisma.card.findUnique({
				where: { id: cardId },
				include: {
					users: true
				}
			})

			if (!cardToCopy) {
				throw new Error('Card to copy not found')
			}

			// Шаг 2: Увеличиваем order всех последующих карточек
			await prisma.card.updateMany({
				where: {
					listId: listId,
					order: { gte: cardToCopy.order }
				},
				data: {
					order: { increment: 1 }
				}
			})

			// Шаг 3: Создаем копию карточки с order, увеличенным на 1
			const newCard = await prisma.card.create({
				data: {
					...cardToCopy,
					id: undefined,
					name: `${cardToCopy.name} - copy`,
					order: cardToCopy.order + 1,
					users: {
						connect: cardToCopy.users.map(user=> ({
							id: user.id
						}))
					},
					createdAt: new Date(), // Обновляем дату создания
					updatedAt: new Date() // Обновляем дату обновления
				},
				include: {
					users: true
				}
			})

			return newCard
		})
	}

	async update(dto: Partial<CardUpdate>, cardId: string) {
		return this.prisma.card.update({
			where: {
				id: cardId
			},
			data: dto
		})
	}

	async updateOrder(cardsWithNewOrder: CardOrderUpdateDto[]) {
		return this.prisma.$transaction(async prisma => {
			const updatePromises = cardsWithNewOrder.map(({ id, order, listId }) =>
				prisma.card.update({
					where: { id },
					data: {
						order,
						list: {
							connect: {
								id: listId
							}
						}
					}
				})
			)

			return Promise.all(updatePromises)
		})
	}

	async delete(cardId: string, userId: string) {
		return this.prisma.card.delete({
			where: {
				id: cardId,
				list: {
					board: {
						userId
					}
				}
			}
		})
	}
}
