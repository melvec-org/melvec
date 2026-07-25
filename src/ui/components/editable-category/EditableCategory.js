import React, { useEffect, useState } from 'react';

const EditableCategory = ({ categoryId = '', selectionList = [], videoId = '', onCategoryChange }) => {
    const [selectedCategory, setSelectedCategory] = useState(categoryId || '');

    useEffect(() => {
        setSelectedCategory(categoryId || '');
    }, [categoryId, videoId]);

    const onSelectionChange = (nextCategoryId) => {
        setSelectedCategory(nextCategoryId);
        if (videoId !== '') {
            onCategoryChange(videoId, nextCategoryId === '' ? null : nextCategoryId);
        } else {
            onCategoryChange(nextCategoryId === '' ? null : nextCategoryId);
        }
    };

    return (
        <select value={selectedCategory} onChange={(e) => onSelectionChange(e.target.value)}>
            <option value="" disabled>
                Select category
            </option>
            {selectionList.map((item) => (
                <option key={item.id} value={item.id} title={item.description}>
                    {item.label}
                </option>
            ))}
        </select>
    );
};

export default EditableCategory;
