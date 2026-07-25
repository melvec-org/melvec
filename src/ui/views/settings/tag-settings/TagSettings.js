import React, { useEffect, useRef, useState } from 'react';

import { useApplicationContext } from '__contexts/app.context';
import EditableList from '__components/editable-list/EditableList';
import settingStyles from '../Settings.css';

import rendererEvents from '__events/rendererEvents';

import getRelativeComplement from '../../../utils/getRelativeComplement';
import {
    HeaderControlBar,
    HeaderControlBarRight,
    HeaderControlBarLeft,
} from '__components/core-components/header-control-bar/HeaderControlBar';
import SortingSelector from '__components/core-components/sorting-selector/SortingSelector';
import {
    ContextualActionButton,
    ContextualActionControl,
} from '__components/core-components/contextual-action-control/ContextualActionControl';
import InputFilter from '__components/core-components/input-filter/InputFilter';
import AddNewTag from '__components/add-tag/AddNewTag';
import Button from '__components/core-components/button/Button';
import useTagActions from '__actions/useTagActions';
import TagEditor from '__components/tag-editor/TagEditor';
import cloneDeep from '__utils/cloneDeep';
import sortBy from '__utils/sortBy';
import ipcChannels from '__constants/ipcChannels';

const LETTERS = Array.from({ length: 26 }, (_, i) => ({
    label: String.fromCharCode(65 + i),
    active: false,
}));
const LetterFilter = ({ setSelection, activeLetters = [] }) => {
    const [selectedLetter, setSelectedLetter] = useState(null);

    const onLetterClick = (letter) => {
        let selection = null;

        if (letter === selectedLetter) {
            selection = null;
        } else {
            selection = letter.label;
        }

        setSelectedLetter(selection === null ? null : letter);
        setSelection(selection);
    };

    useEffect(() => {
        LETTERS.forEach((letter) => {
            letter.active = activeLetters.includes(letter.label);
        });
    }, [activeLetters]);

    return (
        <div className={settingStyles.letterFilterWrapper}>
            {LETTERS.map((letter) => (
                <div
                    key={letter.label}
                    className={`${settingStyles.letterFilterItem} ${selectedLetter === letter ? `${settingStyles.activeLetterFilter}` : ''}`}
                    onClick={() => onLetterClick(letter)}
                    active={letter.active ? 'active' : 'inactive'}
                >
                    {letter.label}
                </div>
            ))}
        </div>
    );
};
const TagFooterActions = () => {
    const [openNewTag, setOpenNewTag] = useState(false);

    const buttonRef = useRef(null);
    const onTagAdd = () => {
        setOpenNewTag(false);
        setTimeout(() => {
            buttonRef.current.focus();
        }, 100); // To give the input field time to focus
    };

    return (
        <div className={settingStyles.settingsFooterActions}>
            <Button onClick={() => setOpenNewTag(true)} ref={buttonRef}>
                Add new tag
            </Button>
            {openNewTag && <AddNewTag onTagAdd={onTagAdd} onCancel={onTagAdd} />}
        </div>
    );
};

const getActiveLetters = (tags) => {
    const letters = new Set();

    tags.forEach((tag) => {
        letters.add(tag.label.charAt(0).toUpperCase());
    });

    return Array.from(letters);
};

const TagSettings = () => {
    const [stateContext] = useApplicationContext();
    const [showImportError, setShowImportError] = useState(false);
    const [importStarted, setImportStarted] = useState(false);
    const [tags, setTags] = useState(stateContext.tags);
    const [sortingOrder, setSortingOrder] = useState('recent_asc');
    const [textToFilter, setTextToFilter] = useState('');
    const [activeLetters, setActiveLetters] = useState(getActiveLetters(stateContext.tags));

    const [startWith, setStartWith] = useState(null);

    const [tagToEdit, setTagToEdit] = useState(null);

    const { removeTag } = useTagActions();

    const exportTagNames = (tags) => {
        const dateStamp =
            new Date().getFullYear().toString() +
            '_' +
            (new Date().getMonth() + 1).toString() +
            '_' +
            new Date().getDate().toString() +
            '_' +
            new Date().getHours().toString() +
            '_' +
            new Date().getMinutes().toString();

        window.api.send(ipcChannels.DOWNLOAD_FILE, {
            title: 'Save tags File',
            fileName: `tags_${dateStamp}.json`,
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            fileContent: tags,
        });
    };

    /**
     * import token can be optimized to import multiple times or in parallel
     * for now we dont need it.
     */
    const importTagNames = () => {
        setImportStarted(true);

        window.api.send(ipcChannels.IMPORT_FILE_REQUEST, {
            title: 'Import tags',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            eventInitiator: 'TAGS',
        });
    };

    useEffect(() => {
        if (importStarted) {
            window.api.receive(ipcChannels.IMPORT_FILE_ACTION, (message) => {
                if ((message.eventInitiator = 'TAGS')) {
                    const listToBeImported = message.payload;
                    let filteredListToBeImported = [];
                    if (listToBeImported[0]) {
                        filteredListToBeImported = getRelativeComplement(listToBeImported, stateContext.tags);
                    }

                    if (filteredListToBeImported[0]) {
                        window.api.send(ipcChannels.NOTIFY_MAIN_PROCESS, {
                            event: rendererEvents.IMPORT_TAGS,
                            tags: filteredListToBeImported,
                        });
                    }
                }
                setImportStarted(false);
            });
        }
    }, [importStarted]);

    const onSortingChange = (order) => {
        setSortingOrder(order);
    };

    const onTextFilter = (str) => {
        setTextToFilter(str);
    };

    useEffect(() => {
        let tagsToBeShown = cloneDeep(stateContext.tags);

        if (startWith) {
            tagsToBeShown = tagsToBeShown.filter((item) => item.label.toUpperCase().startsWith(startWith));
        }

        if (textToFilter !== '') {
            tagsToBeShown = tagsToBeShown.filter((item) => item.label.includes(textToFilter));
        }
        if (sortingOrder === 'A-Z') {
            setTags(sortBy(tagsToBeShown, 'label'));
        }
        if (sortingOrder === 'Z-A') {
            setTags(sortBy(tagsToBeShown, 'label').reverse());
        }
        if (sortingOrder === 'recent_asc') {
            setTags(tagsToBeShown);
        }
        if (sortingOrder === 'recent_desc') {
            setTags(tagsToBeShown.reverse());
        }
    }, [sortingOrder, textToFilter, stateContext.tags, startWith]);

    return (
        <div>
            <HeaderControlBar>
                <HeaderControlBarLeft>
                    <h3>Your custom tags</h3>
                </HeaderControlBarLeft>
                <HeaderControlBarRight>
                    <InputFilter onChange={onTextFilter} />
                    <SortingSelector
                        options={[
                            { value: 'A-Z', label: 'A-Z' },
                            { value: 'Z-A', label: 'Z-A' },
                            { value: 'recent_asc', label: 'Recent first' },
                            { value: 'recent_desc', label: 'Recent last' },
                        ]}
                        placeholder={'Sort tags'}
                        onChange={onSortingChange}
                    ></SortingSelector>
                    <ContextualActionControl>
                        <ContextualActionButton onClick={() => exportTagNames(stateContext.tags)}>Export tag names</ContextualActionButton>
                        <ContextualActionButton onClick={() => importTagNames()}>Import tag names</ContextualActionButton>
                    </ContextualActionControl>
                </HeaderControlBarRight>
            </HeaderControlBar>
            <LetterFilter setSelection={setStartWith} activeLetters={activeLetters} />
            <EditableList removeHandler={(item) => removeTag(item)} editHandler={(item) => setTagToEdit(item)} list={tags} />
            <div>{showImportError && <p>Import could not be done.</p>}</div>
            <TagFooterActions />
            {tagToEdit && <TagEditor tagsList={tags} tag={tagToEdit} onEditDone={() => setTagToEdit(null)} />}
        </div>
    );
};
export default TagSettings;
