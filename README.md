# Helios Control

Helios Control is a modern, responsive web application built with Next.js and designed to provide a real-time dashboard for monitoring your GivEnergy energy system. Leveraging the GivEnergy API, it offers a clear and intuitive view of key energy metrics, including solar generation, home consumption, battery status, grid interaction, and EV charger activity.

Developed within Firebase Studio, this project demonstrates seamless integration with Firebase services and utilizes advanced AI coding assistance for enhanced development.

## New Features and Improvements (from Firebase Studio)

Helios Control benefits from features provided by the development environment:

*   **AI Coding Assistance:** Get intelligent code suggestions and complete tasks faster, accelerating development workflows.
*   **Multimodal Prompting:** Utilize a wider range of input types for AI interactions, allowing for more flexible and powerful assistance.
*   **Improved Performance:** Experience a faster and more responsive development environment, leading to increased productivity.
*   **More Customization Options:** Tailor the Studio to your preferences and workflow, creating a personalized development experience.

## Helios Control Features

-   **Real-Time Dashboard:** Provides an immediate and dynamic overview of your energy system's performance. Visual cards are used to clearly display key metrics such as Home Consumption, Solar Generation, Battery Status, Grid Status, and EV Charger status, all powered by real-time data fetched directly from the GivEnergy API. Data updates are designed to be near-instantaneous, reflecting the current state of your system.
-   **API Key Management:** Ensures the secure handling of your sensitive GivEnergy API key. The key is stored securely using local storage within your browser, providing a balance between convenience and security. Import and export functionality allows you to easily back up your API key or transfer it between browsers or devices.
-   **ID Fetch:** Simplifies the initial setup process by automatically discovering and fetching necessary identifiers from the GivEnergy API based on your provided API key. This includes accurately determining your primary Inverter Serial Number and its unique UUID, which are crucial for making targeted API calls. The process also attempts to identify your associated EV Charger ID if one is present in your GivEnergy account.
-   **GivEnergy API Integration:** Facilitates robust and seamless communication with the GivEnergy platform. The application includes a dedicated input field for your API key with built-in validation to ensure that the key is correct and active before attempting to fetch data. Once validated, the application efficiently fetches and displays comprehensive real-time energy data.
-   **High Consumption Alerts:** Keeps you proactively informed about your energy usage patterns. The system is configured to display clear visual alerts on the dashboard when consumption levels from the grid exceed a predefined threshold. This feature helps you quickly identify periods of unusually high energy draw and potentially take action to reduce consumption or investigate the cause.

## Style Guidelines

-   **Primary colour:** Orange (#FFA500) is used as the dominant color for backgrounds and highlights, creating a vibrant and energetic feel that aligns with the theme of energy.
-   **Secondary colour:** Black (#000000) serves as the secondary color, providing a strong contrast and evoking a dark theme aesthetic for readability and visual impact.
-   **Accent:** Silver (#C0C0C0) is used as an accent color, particularly for buttons and interactive elements, providing a subtle metallic sheen that suggests modern technology and precision.
-   **Theming:** Offers comprehensive theme support to cater to different user preferences and accessibility needs. Options include a standard Light Theme, a visually striking Dark Theme, and High Contrast Light and High Contrast Dark Theme options to improve readability for users with visual impairments.
-   **Body and headline font:** 'Inter', a widely recognized sans-serif font, is used for both body text and headlines. It is chosen for its modern, machined, objective, and neutral look, ensuring excellent readability and contributing to a clean and professional aesthetic throughout the application.
-   **Icons:** Employs a carefully selected set of consistent and clear icons. These icons are designed to intuitively represent different energy data points (such as solar production, battery charge, grid import/export, and EV charging status), significantly improving visual clarity and ease of understanding the dashboard information at a glance.
-   **Layout:** Utilizes a clean, organized, and modular card-based layout to present information effectively. Each key metric is contained within its own distinct card, making the dashboard easy to scan and understand. The design is fully responsive, ensuring an optimal viewing experience with layouts that adapt seamlessly on various screen sizes, from mobile devices to large desktop monitors.
-   **Interactions:** Incorporates subtle and smooth transitions and animations. These are applied to data updates on the cards and for chart interactions, providing a polished, engaging, and modern user experience without being distracting.

## Getting Started

To begin using Helios Control, follow these steps:

1.  **Clone the repository:**

To get started, take a look at src/app/page.tsx.

npm install
npm install next
npm install react
npm install recharts
npm install axios
npm install react-day-picker date-fns

