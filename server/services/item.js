const mongoose = require("mongoose");

const validate = require("../util/validate");

const AccountModel = require("../models/account");
const ItemModel = require("../models/item");

exports.list = async ({ accountId, title, price, stock, description }) => {
  try {
    validate.item({ title, price, stock, description });

    const account = await AccountModel.findOne({ id: accountId });
    if (account == null) throw new Error("Account does not exist.");

    const expirationDate = new Date();
    expirationDate.setDate(
      expirationDate.getDate() + process.env.DAYS_TO_EXPIRE
    );

    await ItemModel.create({
      id: mongoose.Types.ObjectId().toString(),
      account_id: accountId,
      title,
      price,
      stock,
      description,
      expiration_date: expirationDate
    });
  } catch (err) {
    console.log(err);
    throw new Error("Unable to list item.");
  }
};

exports.close = async ({ accountId, id }) => {
  try {
    const { n } = await ItemModel.updateOne(
      { id, account_id: accountId },
      { expiration_date: new Date() }
    );
    if (n === 0) throw new Error("Item does not exist.");
  } catch (err) {
    console.log(err);
    throw new Error("Unable to close item.");
  }
};

exports.setWatch = async ({ accountId, id, watching }) => {
  try {
    const account = await AccountModel.findOne({ id: accountId });
    if (account == null) throw new Error("Account does not exist.");
    let { items_watching } = account;

    const item = await ItemModel.findOne({ id }, { _id: 1 });
    if (item == null) throw new Error("Item does not exist.");

    if (watching === false) {
      items_watching = items_watching.filter((value) => value != id);
    } else {
      if (!items_watching.includes(id)) items_watching.push(id);
    }

    const { n } = await AccountModel.updateOne(
      { id: accountId },
      { items_watching }
    );
    if (n === 0) throw new Error("Account does not exist.");
  } catch (err) {
    console.log(err);
    throw new Error("Unable to set watch on item.");
  }
};

exports.getSearch = async ({ page, sort, searchText }) => {
  try {
    const findConditions = {
      expiration_date: { $gt: new Date() },
      stock: { $gt: 0 }
    };

    return await get({ findConditions, page, sort, searchText });
  } catch (err) {
    console.log(err);
    throw new Error("Unable to set watch on item.");
  }
};

exports.getWatching = async ({ accountId, page, sort, searchText }) => {
  try {
    const account = await AccountModel.findOne({ id: accountId });
    if (account == null) throw new Error("Account does not exist.");

    const findConditions = {
      id: { $in: account.items_watching }
    };

    return await get({ findConditions, page, sort, searchText });
  } catch (err) {
    console.log(err);
    throw new Error("Unable to set watch on item.");
  }
};

exports.getSelling = async ({ accountId, page, sort, searchText }) => {
  try {
    const findConditions = {
      expiration_date: { $gt: new Date() },
      stock: { $gt: 0 },
      account_id: accountId
    };

    return await get({ findConditions, page, sort, searchText });
  } catch (err) {
    console.log(err);
    throw new Error("Unable to set watch on item.");
  }
};

exports.getSold = async ({ accountId, page, sort, searchText }) => {
  try {
    const findConditions = {
      $or: [{ expiration_date: { $lte: new Date() } }, { stock: { $lte: 0 } }],
      account_id: accountId
    };

    return await get({ findConditions, page, sort, searchText });
  } catch (err) {
    console.log(err);
    throw new Error("Unable to set watch on item.");
  }
};

exports.getUnsold = async ({ accountId, page, sort, searchText }) => {
  try {
    const findConditions = {
      $or: [{ expiration_date: { $lte: new Date() } }, { stock: { $lte: 0 } }],
      account_id: accountId
    };

    return await get({ findConditions, page, sort, searchText });
  } catch (err) {
    console.log(err);
    throw new Error("Unable to set watch on item.");
  }
};

async function get({ findConditions, page, sort, searchText }) {
  page = Number(page) || 1;

  if (searchText != null && searchText != "")
    findConditions["$search"] = { $search: searchText };

  const totalItems = await ItemModel.countDocuments(findConditions).exec();

  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / process.env.ITEMS_PER_PAGE)
  );

  const currentPage = Math.max(1, Math.min(totalPages, Number(page)));

  const sortTypes = {
    priceAsc: { price: 1 },
    priceDesc: { price: -1 },
    dateAsc: { expiration_date: 1 },
    dateDesc: { expiration_date: -1 }
  };
  if (sortTypes[sort] == null) sort = "dateAsc";

  const results = await ItemModel.find(findConditions)
    .sort(sortTypes[sort])
    .limit(Number(process.env.ITEMS_PER_PAGE))
    .skip(Number(process.env.ITEMS_PER_PAGE * (currentPage - 1)))
    .exec();

  const items = {};
  for (const result of results) {
    items[result.id] = {
      id: result.id,
      title: result.title,
      price: result.price,
      description: result.description,
      expirationDate: result.expiration_date,
      stock: result.stock
    };
  }

  return {
    items,
    totalItems,
    totalPages,
    currentPage,
    sort
  };
}
