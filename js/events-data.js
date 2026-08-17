// Birdie Squad Golf Club - Central Events Data
(function() {
    const events = [
        {
            id: "captains-day-meat-comp-2026",
            slug: "captains-day-meat-comp-31-may-2026",
            title: "Captains Day Meat Comp",
            status: "past",
            featured: false,
            date: "2026-05-31",
            reportingTime: "08:30",
            teeOffTime: "09:00",
            venue: "Nigel GC",
            location: "Nigel Golf Club",
            greenFee: "R300.00",
            note: "Wear any Birdie Squad T-shirt.",
            shortDescription: "Join Birdie Squad Golf Club for Captains Day Meat Comp at Nigel GC - a golf day built around competition, networking, prizes, and club spirit.",
            description: "Captains Day Meat Comp brings members, supporters, and golf enthusiasts together for a competitive and social golf experience. The day creates space for recreational golf, networking, sponsor visibility, and stronger club engagement.",
            prizes: [
                { position: "1st Prize", amount: "R1500" },
                { position: "2nd Prize", amount: "R1000" },
                { position: "3rd Prize", amount: "R500" },
                { position: "4th Prize", amount: "R300" }
            ],
            sponsor: "Sunday Social Birdie Squad Golf Club",
            image: "images/events/captains-day-2026.jpeg",
            gallery: [],
            report: null
        }
    ];

    function byDateAsc(a, b) {
        return new Date(a.date) - new Date(b.date);
    }

    function getUpcomingEvents() {
        return events
            .filter((event) => event.status === "upcoming")
            .sort(byDateAsc);
    }

    function getPastEvents() {
        return events
            .filter((event) => event.status === "past")
            .sort(byDateAsc);
    }

    function getFeaturedUpcomingEvent() {
        const featured = getUpcomingEvents().find((event) => event.featured);
        return featured || getUpcomingEvents()[0] || null;
    }

    window.birdieEventsData = {
        events,
        getUpcomingEvents,
        getPastEvents,
        getFeaturedUpcomingEvent
    };
})();
