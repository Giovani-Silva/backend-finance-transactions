import {
  getCustomRepository,
  getRepository,
  TransactionRepository,
} from 'typeorm';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

import AppError from '../errors/AppError';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const { total } = await transactionRepository.getBalance();

    if (type === 'outcome' && total < value) {
      throw new AppError('You don´t have enough balance');
    }

    let category_id = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!category_id) {
      category_id = categoryRepository.create({
        title: category,
      });

      await categoryRepository.save(category_id);
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category: category_id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
