/**
 * Main Entry Point
 * Initializes the application and its core components.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Data Management
    const dataManager = new DataManager();

    // 2. Initialize Business Logic
    const businessLogic = new BusinessLogic(dataManager);

    // 3. Initialize UI Management
    const uiManager = new UIManager(dataManager, businessLogic);

    // 4. Start the Application
    uiManager.init();

    // 5. Initial stock snapshot for change tracking
    dataManager.takeStockSnapshot();

    console.log('Booth POS v2.0 Initialized');
});
