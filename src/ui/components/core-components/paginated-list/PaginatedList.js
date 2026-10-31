import React, { useEffect, useState } from 'react';
import Button from '__components/core-components/button/Button';
import style from './PaginatedList.css';

const DEFAULT_PAGE_SIZE = 100;

const getValidPageNumber = (pageNumber, totalItems, pageSize) => {
    const totalPages = Math.ceil(totalItems / pageSize);

    if (totalPages === 0) {
        return 1;
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
        return 1;
    }

    const startIndex = (pageNumber - 1) * pageSize;

    return startIndex < totalItems ? pageNumber : 1;
};

const PaginatedList = ({ items = [], pageSize = DEFAULT_PAGE_SIZE, currentPage = 1, children }) => {
    const [activePage, setActivePage] = useState(() => getValidPageNumber(currentPage, items.length, pageSize));
    const totalPages = Math.max(Math.ceil(items.length / pageSize), 1);
    const startIndex = (activePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, items.length);
    const visiblePageItems = items.slice(startIndex, endIndex);

    useEffect(() => {
        setActivePage(getValidPageNumber(currentPage, items.length, pageSize));
    }, [currentPage, items, pageSize]);

    useEffect(() => {
        if (activePage > totalPages) {
            setActivePage(totalPages);
        }
    }, [activePage, totalPages]);

    return (
        <>
            {children(visiblePageItems)}

            {items.length > pageSize && (
                <div className={style.paginationControls}>
                    <Button disabled={activePage === 1} onClick={() => setActivePage((page) => page - 1)}>
                        Previous
                    </Button>
                    <span className={style.paginationInfo}>
                        Showing {startIndex + 1}-{endIndex} of {items.length} · Page {activePage} of {totalPages}
                    </span>
                    <Button disabled={activePage === totalPages} onClick={() => setActivePage((page) => page + 1)}>
                        Next
                    </Button>
                </div>
            )}
        </>
    );
};

export default PaginatedList;
