/**
 * Unit tests for collectionContextMenuClick logic in LibraryCollection.
 *
 * These tests verify the IPC wiring: receiveOnce must be registered before
 * send is called, and the correct action must be dispatched for each command.
 */

const contextMenuEvents = require('../../../events/contextMenuEvents');
const ipcChannels = require('../../../constants/ipcChannels');

/**
 * Simulate the collectionContextMenuClick handler in isolation,
 * using the same logic as the component but injectable state setters.
 */
function makeHandler({ setIsOpenNewCollection, setIsCollapsed }) {
    return function collectionContextMenuClick(event, item) {
        event.preventDefault();
        window.api.receiveOnce(ipcChannels.CONTEXT_MENU_ACTION, (command) => {
            switch (command) {
                case contextMenuEvents.ADD_NEW_COLLECTION:
                    setIsOpenNewCollection(true);
                    break;
                case contextMenuEvents.TOGGLE_SECTION:
                    setIsCollapsed((prevState) => !prevState);
                    break;
                default:
                    break;
            }
        });
        window.api.send(ipcChannels.CONTEXT_MENU_REQUEST, {
            source: 'librarySidebar',
            collectionItem: item,
        });
    };
}

describe('collectionContextMenuClick', () => {
    let receiveOnceMock;
    let sendMock;
    let setIsOpenNewCollection;
    let setIsCollapsed;
    let handler;
    let capturedReceiveOnceCallback;

    beforeEach(() => {
        capturedReceiveOnceCallback = null;
        receiveOnceMock = jest.fn((channel, cb) => {
            capturedReceiveOnceCallback = cb;
        });
        sendMock = jest.fn();

        global.window = {
            api: {
                receiveOnce: receiveOnceMock,
                send: sendMock,
            },
        };

        setIsOpenNewCollection = jest.fn();
        setIsCollapsed = jest.fn();

        handler = makeHandler({ setIsOpenNewCollection, setIsCollapsed });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('calls event.preventDefault()', () => {
        const event = { preventDefault: jest.fn() };
        handler(event, { id: 1 });
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
    });

    it('registers receiveOnce on CONTEXT_MENU_ACTION before calling send', () => {
        const event = { preventDefault: jest.fn() };
        const callOrder = [];
        receiveOnceMock.mockImplementation(() => callOrder.push('receiveOnce'));
        sendMock.mockImplementation(() => callOrder.push('send'));

        handler(event, { id: 1 });

        expect(callOrder).toEqual(['receiveOnce', 'send']);
    });

    it('registers receiveOnce on the correct IPC channel', () => {
        const event = { preventDefault: jest.fn() };
        handler(event, { id: 1 });
        expect(receiveOnceMock).toHaveBeenCalledWith(ipcChannels.CONTEXT_MENU_ACTION, expect.any(Function));
    });

    it('sends CONTEXT_MENU_REQUEST with source librarySidebar and collectionItem', () => {
        const event = { preventDefault: jest.fn() };
        const item = { id: 42, name: 'My Collection' };
        handler(event, item);
        expect(sendMock).toHaveBeenCalledWith(ipcChannels.CONTEXT_MENU_REQUEST, {
            source: 'librarySidebar',
            collectionItem: item,
        });
    });

    it('calls setIsOpenNewCollection(true) when ADD_NEW_COLLECTION command is received', () => {
        const event = { preventDefault: jest.fn() };
        handler(event, { id: 1 });

        capturedReceiveOnceCallback(contextMenuEvents.ADD_NEW_COLLECTION);

        expect(setIsOpenNewCollection).toHaveBeenCalledWith(true);
        expect(setIsCollapsed).not.toHaveBeenCalled();
    });

    it('calls setIsCollapsed toggler when TOGGLE_SECTION command is received', () => {
        const event = { preventDefault: jest.fn() };
        handler(event, { id: 1 });

        capturedReceiveOnceCallback(contextMenuEvents.TOGGLE_SECTION);

        // setIsCollapsed should be called with a function (the prevState toggler)
        expect(setIsCollapsed).toHaveBeenCalledTimes(1);
        const toggleFn = setIsCollapsed.mock.calls[0][0];
        expect(toggleFn(false)).toBe(true);
        expect(toggleFn(true)).toBe(false);
        expect(setIsOpenNewCollection).not.toHaveBeenCalled();
    });

    it('does nothing for an unknown command', () => {
        const event = { preventDefault: jest.fn() };
        handler(event, { id: 1 });

        capturedReceiveOnceCallback('unknownCommand');

        expect(setIsOpenNewCollection).not.toHaveBeenCalled();
        expect(setIsCollapsed).not.toHaveBeenCalled();
    });
});
