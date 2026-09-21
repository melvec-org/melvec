const { initializeDb, seedDefaultCategories, getAllCategories } = require('../video-library/categoriesDbService');

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
