import csvParse from 'csv-parse';
import fs from 'fs';
import { getCustomRepository, getRepository, In } from 'typeorm';
import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: string;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const fileStream = fs.createReadStream(filePath);
    const categoryRepository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const parsers = csvParse({
      delimiter: ',',
      from_line: 2,
    });

    const parseCSV = fileStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value || !category) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategories = await categoryRepository.find({
      where: {
        title: In(categories),
      },
    });

    const categoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !categoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoryRepository.create(
      addCategoryTitles.map(title => ({ title })),
    );

    await categoryRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const prepareTransactions = transactions.map(transaction => ({
      title: transaction.title,
      type: transaction.type,
      value: transaction.value,
      category: finalCategories.find(cat => cat.title === transaction.category),
    }));

    const createdTransaction = transactionsRepository.create(
      prepareTransactions,
    );

    await transactionsRepository.save(createdTransaction);

    await fs.promises.unlink(filePath);

    return createdTransaction;
  }
}

export default ImportTransactionsService;
