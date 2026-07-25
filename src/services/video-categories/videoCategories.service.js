const { initializeDb, seedDefaultCategories, getAllCategories } = require('../database/categoriesDbService');

const initVideoCategoriesService = () => {
    initializeDb();
    seedDefaultCategories();
};

const getAllVideoCategories = () => {
    const categories = getAllCategories();
    return categories;
};

module.exports = {
    initVideoCategoriesService,
    getAllVideoCategories,
};
