// Generated from https://esi.evetech.net/meta/openapi.json (X-Compatibility-Date: 2026-08-18) by scripts/esi-types.ts — do not edit.
export interface paths {
    "/alliances": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List all alliances
         * @description List all active player alliances
         */
        get: operations["GetAlliances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alliances/{alliance_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get alliance's public information
         * @description Public information about an alliance
         */
        get: operations["GetAlliancesAllianceId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alliances/{alliance_id}/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get alliance contacts
         * @description Return contacts of an alliance
         */
        get: operations["GetAlliancesAllianceIdContacts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alliances/{alliance_id}/contacts/labels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get alliance contact labels
         * @description Return custom labels for an alliance's contacts
         */
        get: operations["GetAlliancesAllianceIdContactsLabels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alliances/{alliance_id}/corporations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List alliance's corporations
         * @description List all current member corporations of an alliance
         */
        get: operations["GetAlliancesAllianceIdCorporations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/alliances/{alliance_id}/icons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get alliance icon
         * @description Get the icon urls for a alliance
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetAlliancesAllianceIdIcons"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/affiliation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Character affiliation
         * @description Bulk lookup of character IDs to corporation, alliance and faction
         */
        post: operations["PostCharactersAffiliation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character's public information
         * @description Public information about a character
         */
        get: operations["GetCharactersDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/access-lists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Access Lists
         * @description Lists all Access Lists the character is Manager or Admin of.
         */
        get: operations["GetCharactersAccessListsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/access-lists/{access_list_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Access List details
         * @description Get the details of an Access List.
         */
        get: operations["GetCharactersAccessListsDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/agents_research": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get agents research
         * @description Return a list of agents research information for a character. The formula for finding the current research points with an agent is: currentPoints = remainderPoints + pointsPerDay * days(currentTime - researchStartDate)
         */
        get: operations["GetCharactersCharacterIdAgentsResearch"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character assets
         * @description Return a list of the characters assets
         */
        get: operations["GetCharactersCharacterIdAssets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/assets/locations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get character asset locations
         * @description Return locations for a set of item ids, which you can get from character assets endpoint. Coordinates for items in hangars or stations are set to (0,0,0)
         */
        post: operations["PostCharactersCharacterIdAssetsLocations"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/assets/names": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get character asset names
         * @description Return names for a set of item ids, which you can get from character assets endpoint. Typically used for items that can customize names, like containers or ships.
         */
        post: operations["PostCharactersCharacterIdAssetsNames"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/attributes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character attributes
         * @description Return attributes of a character
         */
        get: operations["GetCharactersCharacterIdAttributes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/blueprints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get blueprints
         * @description Return a list of blueprints the character owns
         */
        get: operations["GetCharactersCharacterIdBlueprints"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List calendar event summaries
         * @description Get 50 event summaries from the calendar. If no from_event ID is given, the resource will return the next 50 chronological event summaries from now. If a from_event ID is specified, it will return the next 50 chronological event summaries from after that event
         */
        get: operations["GetCharactersCharacterIdCalendar"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/calendar/{event_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get an event
         * @description Get all the information for a specific event
         */
        get: operations["GetCharactersCharacterIdCalendarEventId"];
        /**
         * Respond to an event
         * @description Set your response status to an event
         */
        put: operations["PutCharactersCharacterIdCalendarEventId"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/calendar/{event_id}/attendees": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get attendees
         * @description Get all invited attendees for a given event
         */
        get: operations["GetCharactersCharacterIdCalendarEventIdAttendees"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/clones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get clones
         * @description A list of the character's clones
         */
        get: operations["GetCharactersCharacterIdClones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get contacts
         * @description Return contacts of a character
         */
        get: operations["GetCharactersCharacterIdContacts"];
        /**
         * Edit contacts
         * @description Bulk edit contacts with same settings
         */
        put: operations["PutCharactersCharacterIdContacts"];
        /**
         * Add contacts
         * @description Bulk add contacts with same settings
         */
        post: operations["PostCharactersCharacterIdContacts"];
        /**
         * Delete contacts
         * @description Bulk delete contacts
         */
        delete: operations["DeleteCharactersCharacterIdContacts"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/contacts/labels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get contact labels
         * @description Return custom labels for a character's contacts
         */
        get: operations["GetCharactersCharacterIdContactsLabels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/contracts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get contracts
         * @description Returns contracts available to a character, only if the character is issuer, acceptor or assignee. Only returns contracts no older than 30 days, or if the status is "in_progress".
         */
        get: operations["GetCharactersCharacterIdContracts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/contracts/{contract_id}/bids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get contract bids
         * @description Lists bids on a particular auction contract
         */
        get: operations["GetCharactersCharacterIdContractsContractIdBids"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/contracts/{contract_id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get contract items
         * @description Lists items of a particular contract
         */
        get: operations["GetCharactersCharacterIdContractsContractIdItems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/corporationhistory": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation history
         * @description Get a list of all the corporations a character has been a member of
         */
        get: operations["GetCharactersCharacterIdCorporationhistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/cosmetics/skinr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a character's owned SKINR licenses
         * @description Listing of all SKINR licenses you own
         */
        get: operations["GetCharactersCosmeticsSkinr"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/cosmetics/skinr/components": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a character's owned SKINR component licenses
         * @description Listing of all SKINR component licenses you own
         */
        get: operations["GetCharactersCosmeticsSkinrComponents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/cspa": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Calculate a CSPA charge cost
         * @description Takes a source character ID in the url and a set of target character ID's in the body, returns a CSPA charge cost
         */
        post: operations["PostCharactersCharacterIdCspa"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/fatigue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get jump fatigue
         * @description Return a character's jump activation and fatigue information
         */
        get: operations["GetCharactersCharacterIdFatigue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/fittings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get fittings
         * @description Return fittings of a character
         */
        get: operations["GetCharactersCharacterIdFittings"];
        put?: never;
        /**
         * Create fitting
         * @description Save a new fitting for a character
         */
        post: operations["PostCharactersCharacterIdFittings"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/fittings/{fitting_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete fitting
         * @description Delete a fitting from a character
         */
        delete: operations["DeleteCharactersCharacterIdFittingsFittingId"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/fleet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character fleet info
         * @description Return the fleet ID the character is in, if any.
         */
        get: operations["GetCharactersCharacterIdFleet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/freelance-jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List character freelance jobs
         * @description Listing of all freelance jobs you are actively participating in.
         */
        get: operations["GetCharactersFreelanceJobsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/freelance-jobs/{job_id}/participation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character freelance job participation
         * @description Show your participation in a freelance job.
         */
        get: operations["GetCharactersFreelanceJobsParticipation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/fw/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Overview of a character involved in faction warfare
         * @description Statistical overview of a character involved in faction warfare
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetCharactersCharacterIdFwStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/implants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get active implants
         * @description Return implants on the active clone of a character
         */
        get: operations["GetCharactersCharacterIdImplants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/industry/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List character industry jobs
         * @description List industry jobs placed by a character
         */
        get: operations["GetCharactersCharacterIdIndustryJobs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/killmails/recent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a character's recent kills and losses
         * @description Return a list of a character's kills and losses going back 90 days
         */
        get: operations["GetCharactersCharacterIdKillmailsRecent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/location": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character location
         * @description Get the current location of a character, including the station or structure it is docked in.
         */
        get: operations["GetCharactersCharacterIdLocation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/loyalty/points": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get loyalty points
         * @description Return a list of loyalty points for all corporations the character has worked for
         */
        get: operations["GetCharactersCharacterIdLoyaltyPoints"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Return mail headers
         * @description Return the 50 most recent mail headers belonging to the character that match the query criteria. Queries can be filtered by label, and last_mail_id can be used to paginate backwards
         */
        get: operations["GetCharactersCharacterIdMail"];
        put?: never;
        /**
         * Send a new mail
         * @description Create and send a new mail
         */
        post: operations["PostCharactersCharacterIdMail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mail/labels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get mail labels and unread counts
         * @description Return a list of the users mail labels, unread counts for each label and a total unread count.
         */
        get: operations["GetCharactersCharacterIdMailLabels"];
        put?: never;
        /**
         * Create a mail label
         * @description Create a mail label
         */
        post: operations["PostCharactersCharacterIdMailLabels"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mail/labels/{label_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Delete a mail label
         * @description Delete a mail label
         */
        delete: operations["DeleteCharactersCharacterIdMailLabelsLabelId"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mail/lists": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Return mailing list subscriptions
         * @description Return all mailing lists that the character is subscribed to
         */
        get: operations["GetCharactersCharacterIdMailLists"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mail/{mail_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Return a mail
         * @description Return the contents of an EVE mail
         */
        get: operations["GetCharactersCharacterIdMailMailId"];
        /**
         * Update metadata about a mail
         * @description Update metadata about a mail
         */
        put: operations["PutCharactersCharacterIdMailMailId"];
        post?: never;
        /**
         * Delete a mail
         * @description Delete a mail
         */
        delete: operations["DeleteCharactersCharacterIdMailMailId"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/medals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get medals
         * @description Return a list of medals the character has
         */
        get: operations["GetCharactersCharacterIdMedals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mercenary-tactical-operations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Mercenary Tactical Operations
         * @description Listing of all Mercenary Tactical Operations for the character.
         */
        get: operations["GetCharactersMercenaryTacticalOperationsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mercenary-tactical-operations/{operation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Mercenary Tactical Operation details
         * @description Get the details of a Mercenary Tactical Operation.
         */
        get: operations["GetCharactersMercenaryTacticalOperationsDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/military-campaigns/objectives": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List character participation in military campaigns
         * @description Listing of the military campaign objectives the character has participated in.
         */
        get: operations["GetCharactersMilitaryCampaignsObjectivesListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/military-campaigns/objectives/{objective_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character military campaign objective participation
         * @description Show your participation in a military campaign objective.
         */
        get: operations["GetCharactersMilitaryCampaignsObjectivesParticipation"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/mining": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Character mining ledger
         * @description Paginated record of all mining done by a character for the past 30 days
         */
        get: operations["GetCharactersCharacterIdMining"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character notifications
         * @description Return character notifications
         */
        get: operations["GetCharactersCharacterIdNotifications"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/notifications/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get new contact notifications
         * @description Return notifications about having been added to someone's contact list
         */
        get: operations["GetCharactersCharacterIdNotificationsContacts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/online": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character online
         * @description Get whether a character is online, and its login statistics.
         */
        get: operations["GetCharactersCharacterIdOnline"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List open orders from a character
         * @description List open market orders placed by a character
         */
        get: operations["GetCharactersCharacterIdOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/orders/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List historical orders by a character
         * @description List cancelled and expired market orders placed by a character up to 90 days in the past.
         */
        get: operations["GetCharactersCharacterIdOrdersHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/paragon-hub/skinr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List a character's Paragon Hub SKINR listings
         * @description List the SKINR listings a character has posted on the Paragon Hub.
         */
        get: operations["GetCharactersParagonHubSkinr"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/planets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get colonies
         * @description Returns a list of all planetary colonies owned by a character.
         */
        get: operations["GetCharactersCharacterIdPlanets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/planets/{planet_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get colony layout
         * @description Returns full details on the layout of a single planetary colony, including links, pins and routes. Note: Planetary information is only recalculated when the colony is viewed through the client. Information will not update until this criteria is met.
         */
        get: operations["GetCharactersCharacterIdPlanetsPlanetId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/portrait": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character portraits
         * @description Get portrait urls for a character
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetCharactersCharacterIdPortrait"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character corporation roles
         * @description Returns a character's corporation roles
         */
        get: operations["GetCharactersCharacterIdRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search on a string
         * @description Search for entities that match a given sub-string.
         */
        get: operations["GetCharactersCharacterIdSearch"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/ship": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get current ship
         * @description Get the ship a character is currently in.
         */
        get: operations["GetCharactersCharacterIdShip"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/skillqueue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character's skill queue
         * @description List the configured skill queue for the given character.
         *
         *     Entries that have their finish time in the past are completed, but aren't updated in the "/skills" route
         *     yet. This will happen the next time the character logs in.
         */
        get: operations["GetCharactersCharacterIdSkillqueue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/skills": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character skills
         * @description List all trained skills for the given character.
         *
         *     Skills returned by this route can be out-of-date if the character hasn't logged in since one or more skills
         *     completed training. Use the /skillqueue route to check for skills that completed training. Entries that are
         *     in the past need to be applied on top of this list to get an accurate view of the character's current skills.
         */
        get: operations["GetCharactersCharacterIdSkills"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/standings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get standings
         * @description Return character standings from agents, NPC corporations, and factions
         */
        get: operations["GetCharactersCharacterIdStandings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/structures/mercenary-dens": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Mercenary Dens
         * @description Listing of all Mercenary Dens.
         */
        get: operations["GetCharactersStructuresMercenaryDensListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/structures/mercenary-dens/{mercenary_den_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Mercenary Den details
         * @description Get the details of a Mercenary Den.
         */
        get: operations["GetCharactersStructuresMercenaryDensDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/titles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character corporation titles
         * @description Returns a character's titles
         */
        get: operations["GetCharactersCharacterIdTitles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a character's wallet balance
         * @description Returns a character's wallet balance
         */
        get: operations["GetCharactersCharacterIdWallet"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/wallet/journal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character wallet journal
         * @description Retrieve the given character's wallet journal going 30 days back
         */
        get: operations["GetCharactersCharacterIdWalletJournal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/characters/{character_id}/wallet/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get wallet transactions
         * @description Get wallet transactions of a character
         */
        get: operations["GetCharactersCharacterIdWalletTransactions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contracts/public/bids/{contract_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get public contract bids
         * @description Lists bids on a public auction contract
         */
        get: operations["GetContractsPublicBidsContractId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contracts/public/items/{contract_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get public contract items
         * @description Lists items of a public contract
         */
        get: operations["GetContractsPublicItemsContractId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/contracts/public/{region_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get public contracts
         * @description Returns a paginated list of all public contracts in the given region
         */
        get: operations["GetContractsPublicRegionId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporation/{corporation_id}/mining/extractions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Moon extraction timers
         * @description Extraction timers for all moon chunks being extracted by refineries belonging to a corporation.
         */
        get: operations["GetCorporationCorporationIdMiningExtractions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporation/{corporation_id}/mining/observers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Corporation mining observers
         * @description Paginated list of all entities capable of observing and recording mining for a corporation
         */
        get: operations["GetCorporationCorporationIdMiningObservers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporation/{corporation_id}/mining/observers/{observer_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Observed corporation mining
         * @description Paginated record of all mining seen by an observer
         */
        get: operations["GetCorporationCorporationIdMiningObserversObserverId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/npccorps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get npc corporations
         * @description Get a list of npc corporations
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetCorporationsNpccorps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation's public information
         * @description Public information about a corporation
         */
        get: operations["GetCorporationsCorporationId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/alliancehistory": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get alliance history
         * @description Get a list of all the alliances a corporation has been a member of
         */
        get: operations["GetCorporationsCorporationIdAlliancehistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/assets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation assets
         * @description Return a list of the corporation assets
         */
        get: operations["GetCorporationsCorporationIdAssets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/assets/locations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get corporation asset locations
         * @description Return locations for a set of item ids, which you can get from corporation assets endpoint. Coordinates for items in hangars or stations are set to (0,0,0)
         */
        post: operations["PostCorporationsCorporationIdAssetsLocations"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/assets/names": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get corporation asset names
         * @description Return names for a set of item ids, which you can get from corporation assets endpoint. Only valid for items that can customize names, like containers or ships
         */
        post: operations["PostCorporationsCorporationIdAssetsNames"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/blueprints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation blueprints
         * @description Returns a list of blueprints the corporation owns
         */
        get: operations["GetCorporationsCorporationIdBlueprints"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/contacts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation contacts
         * @description Return contacts of a corporation
         */
        get: operations["GetCorporationsCorporationIdContacts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/contacts/labels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation contact labels
         * @description Return custom labels for a corporation's contacts
         */
        get: operations["GetCorporationsCorporationIdContactsLabels"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/containers/logs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get all corporation ALSC logs
         * @description Returns logs recorded in the past seven days from all audit log secure containers (ALSC) owned by a given corporation
         */
        get: operations["GetCorporationsCorporationIdContainersLogs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/contracts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation contracts
         * @description Returns contracts available to a corporation, only if the corporation is issuer, acceptor or assignee. Only returns contracts no older than 30 days, or if the status is "in_progress".
         */
        get: operations["GetCorporationsCorporationIdContracts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/contracts/{contract_id}/bids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation contract bids
         * @description Lists bids on a particular auction contract
         */
        get: operations["GetCorporationsCorporationIdContractsContractIdBids"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/contracts/{contract_id}/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation contract items
         * @description Lists items of a particular contract
         */
        get: operations["GetCorporationsCorporationIdContractsContractIdItems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/customs_offices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List corporation customs offices
         * @description List customs offices owned by a corporation
         */
        get: operations["GetCorporationsCorporationIdCustomsOffices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/divisions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation divisions
         * @description Return corporation hangar and wallet division names, only show if a division is not using the default name
         */
        get: operations["GetCorporationsCorporationIdDivisions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/facilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation facilities
         * @description Return a corporation's facilities
         */
        get: operations["GetCorporationsCorporationIdFacilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/freelance-jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List corporation freelance jobs
         * @description Listing of all freelance jobs for your corporation.
         */
        get: operations["GetCorporationsFreelanceJobsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/freelance-jobs/{job_id}/participants": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List participants of a freelance job
         * @description Listing of all participants of a freelance job.
         */
        get: operations["GetCorporationsFreelanceJobsParticipants"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/fw/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Overview of a corporation involved in faction warfare
         * @description Statistics about a corporation involved in faction warfare
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetCorporationsCorporationIdFwStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/icons": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation icon
         * @description Get the icon urls for a corporation
         */
        get: operations["GetCorporationsCorporationIdIcons"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/industry/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List corporation industry jobs
         * @description List industry jobs run by a corporation
         */
        get: operations["GetCorporationsCorporationIdIndustryJobs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/killmails/recent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a corporation's recent kills and losses
         * @description Get a list of a corporation's kills and losses going back 90 days
         */
        get: operations["GetCorporationsCorporationIdKillmailsRecent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/medals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation medals
         * @description Returns a corporation's medals
         */
        get: operations["GetCorporationsCorporationIdMedals"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/medals/issued": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation issued medals
         * @description Returns medals issued by a corporation
         */
        get: operations["GetCorporationsCorporationIdMedalsIssued"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation members
         * @description Return the current member list of a corporation, the token's character need to be a member of the corporation.
         */
        get: operations["GetCorporationsCorporationIdMembers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/members/limit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation member limit
         * @description Return a corporation's member limit, not including CEO himself
         */
        get: operations["GetCorporationsCorporationIdMembersLimit"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/members/titles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation's members' titles
         * @description Returns a corporation's members' titles
         */
        get: operations["GetCorporationsCorporationIdMembersTitles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/membertracking": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Track corporation members
         * @description Returns additional information about a corporation's members which helps tracking their activities
         */
        get: operations["GetCorporationsCorporationIdMembertracking"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List open orders from a corporation
         * @description List open market orders placed on behalf of a corporation
         */
        get: operations["GetCorporationsCorporationIdOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/orders/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List historical orders from a corporation
         * @description List cancelled and expired market orders placed on behalf of a corporation up to 90 days in the past.
         */
        get: operations["GetCorporationsCorporationIdOrdersHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List corporation projects
         * @description Listing of all (active) corporation projects.
         */
        get: operations["GetCorporationsProjectsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/projects/{project_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get project details
         * @description Get the details of a corporation project.
         */
        get: operations["GetCorporationsProjectsDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/projects/{project_id}/contribution/{character_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get your project contribution
         * @description Show your contribution to a corporation project.
         */
        get: operations["GetCorporationsProjectsContribution"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/projects/{project_id}/contributors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List project contributors
         * @description Listing of all contributors to a corporation project.
         */
        get: operations["GetCorporationsProjectsContributors"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation member roles
         * @description Return the roles of all members if the character has the personnel manager role or any grantable role.
         */
        get: operations["GetCorporationsCorporationIdRoles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/roles/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation member roles history
         * @description Return how roles have changed for a coporation's members, up to a month
         */
        get: operations["GetCorporationsCorporationIdRolesHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/shareholders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation shareholders
         * @description Return the current shareholders of a corporation.
         */
        get: operations["GetCorporationsCorporationIdShareholders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/standings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation standings
         * @description Return corporation standings from agents, NPC corporations, and factions
         */
        get: operations["GetCorporationsCorporationIdStandings"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/starbases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation starbases (POSes)
         * @description Returns list of corporation starbases (POSes)
         */
        get: operations["GetCorporationsCorporationIdStarbases"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/starbases/{starbase_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get starbase (POS) detail
         * @description Returns various settings and fuels of a starbase (POS)
         */
        get: operations["GetCorporationsCorporationIdStarbasesStarbaseId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/structures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation structures
         * @description Get a list of corporation structures. This route's version includes the changes to structures detailed in this blog: https://www.eveonline.com/article/upwell-2.0-structures-changes-coming-on-february-13th
         */
        get: operations["GetCorporationsCorporationIdStructures"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/structures/skyhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Skyhooks
         * @description Listing of all Skyhooks.
         */
        get: operations["GetCorporationsStructuresSkyhooksListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/structures/skyhooks/{skyhook_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Skyhook details
         * @description Get the details of a Skyhook.
         */
        get: operations["GetCorporationsStructuresSkyhooksDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/structures/sovereignty-hubs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Sovereignty Hubs
         * @description Listing of all Sovereignty Hubs.
         */
        get: operations["GetCorporationsStructuresSovereigntyHubsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/structures/sovereignty-hubs/{sovereignty_hub_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get Sovereignty Hub details
         * @description Get the details of a Sovereignty Hub.
         */
        get: operations["GetCorporationsStructuresSovereigntyHubsDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/titles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation titles
         * @description Returns a corporation's titles
         */
        get: operations["GetCorporationsCorporationIdTitles"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/wallets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Returns a corporation's wallet balance
         * @description Get a corporation's wallets
         */
        get: operations["GetCorporationsCorporationIdWallets"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/wallets/{division}/journal": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation wallet journal
         * @description Retrieve the given corporation's wallet journal for the given division going 30 days back
         */
        get: operations["GetCorporationsCorporationIdWalletsDivisionJournal"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/corporations/{corporation_id}/wallets/{division}/transactions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get corporation wallet transactions
         * @description Get wallet transactions of a corporation
         */
        get: operations["GetCorporationsCorporationIdWalletsDivisionTransactions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/cosmetics/skinr/{skinr_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get SKINR attributes
         * @description All attributes of a SKINR license
         */
        get: operations["GetCosmeticsSkinr"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dogma/attributes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get attributes
         * @description Get a list of dogma attribute ids
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetDogmaAttributes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dogma/attributes/{attribute_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get attribute information
         * @description Get information on a dogma attribute
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetDogmaAttributesAttributeId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dogma/dynamic/items/{type_id}/{item_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get dynamic item information
         * @description Returns info about a dynamic item resulting from mutation with a mutaplasmid.
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetDogmaDynamicItemsTypeIdItemId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dogma/effects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get effects
         * @description Get a list of dogma effect ids
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetDogmaEffects"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dogma/effects/{effect_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get effect information
         * @description Get information on a dogma effect
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetDogmaEffectsEffectId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get fleet information
         * @description Return details about a fleet
         */
        get: operations["GetFleetsFleetId"];
        /**
         * Update fleet
         * @description Update settings about a fleet
         */
        put: operations["PutFleetsFleetId"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get fleet members
         * @description Return information about fleet members
         */
        get: operations["GetFleetsFleetIdMembers"];
        put?: never;
        /**
         * Create fleet invitation
         * @description Invite a character into the fleet. If a character has a CSPA charge set it is not possible to invite them to the fleet using ESI
         */
        post: operations["PostFleetsFleetIdMembers"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}/members/{member_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Move fleet member
         * @description Move a fleet member around
         */
        put: operations["PutFleetsFleetIdMembersMemberId"];
        post?: never;
        /**
         * Kick fleet member
         * @description Kick a fleet member
         */
        delete: operations["DeleteFleetsFleetIdMembersMemberId"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}/squads/{squad_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Rename fleet squad
         * @description Rename a fleet squad
         */
        put: operations["PutFleetsFleetIdSquadsSquadId"];
        post?: never;
        /**
         * Delete fleet squad
         * @description Delete a fleet squad, only empty squads can be deleted
         */
        delete: operations["DeleteFleetsFleetIdSquadsSquadId"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}/wings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get fleet wings
         * @description Return information about wings in a fleet
         */
        get: operations["GetFleetsFleetIdWings"];
        put?: never;
        /**
         * Create fleet wing
         * @description Create a new wing in a fleet
         */
        post: operations["PostFleetsFleetIdWings"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}/wings/{wing_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Rename fleet wing
         * @description Rename a fleet wing
         */
        put: operations["PutFleetsFleetIdWingsWingId"];
        post?: never;
        /**
         * Delete fleet wing
         * @description Delete a fleet wing, only empty wings can be deleted. The wing may contain squads, but the squads must be empty
         */
        delete: operations["DeleteFleetsFleetIdWingsWingId"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fleets/{fleet_id}/wings/{wing_id}/squads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Create fleet squad
         * @description Create a new squad in a fleet
         */
        post: operations["PostFleetsFleetIdWingsWingIdSquads"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/freelance-jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List freelance jobs
         * @description Listing of all public freelance jobs.
         */
        get: operations["GetFreelanceJobsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/freelance-jobs/{job_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get freelance job details
         * @description Get the details of a freelance job.
         *
         *     Jobs without an ACL (public jobs) does not require authentication.
         *
         *     Jobs with an ACL requires authentication, and requires that the character is:
         *     - An active participant of the job, or
         *     - A freelance job manager for the corporation that owns the job.
         */
        get: operations["GetFreelanceJobsDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fw/leaderboards": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List of the top factions in faction warfare
         * @description Top 4 leaderboard of factions for kills and victory points separated by total, last week and yesterday
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetFwLeaderboards"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fw/leaderboards/characters": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List of the top pilots in faction warfare
         * @description Top 100 leaderboard of pilots for kills and victory points separated by total, last week and yesterday
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetFwLeaderboardsCharacters"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fw/leaderboards/corporations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List of the top corporations in faction warfare
         * @description Top 10 leaderboard of corporations for kills and victory points separated by total, last week and yesterday
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetFwLeaderboardsCorporations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fw/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * An overview of statistics about factions involved in faction warfare
         * @description Statistical overviews of factions involved in faction warfare
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetFwStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fw/systems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Ownership of faction warfare systems
         * @description An overview of the current ownership of faction warfare solar systems
         */
        get: operations["GetFwSystems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/fw/wars": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Data about which NPC factions are at war
         * @description Data about which NPC factions are at war
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetFwWars"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/incursions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List incursions
         * @description Return a list of current incursions
         */
        get: operations["GetIncursions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/industry/facilities": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List industry facilities
         * @description Return a list of industry facilities
         */
        get: operations["GetIndustryFacilities"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/industry/systems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List solar system cost indices
         * @description Return cost indices for solar systems
         */
        get: operations["GetIndustrySystems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/insurance/prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List insurance levels
         * @description Return available insurance levels for all ship types
         */
        get: operations["GetInsurancePrices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/killmails/{killmail_id}/{killmail_hash}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a single killmail
         * @description Return a single killmail from its ID and hash
         */
        get: operations["GetKillmailsKillmailIdKillmailHash"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/loyalty/stores/{corporation_id}/offers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List loyalty store offers
         * @description Return a list of offers from a specific corporation's loyalty store
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetLoyaltyStoresCorporationIdOffers"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get item groups
         * @description Get a list of item groups
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetMarketsGroups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/groups/{market_group_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get item group information
         * @description Get information on an item group
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetMarketsGroupsMarketGroupId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List market prices
         * @description Return a list of prices
         */
        get: operations["GetMarketsPrices"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/structures/{structure_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List orders in a structure
         * @description Return all orders in a structure
         */
        get: operations["GetMarketsStructuresStructureId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/{region_id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List historical market statistics in a region
         * @description Return a list of historical market statistics for the specified type in a region
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetMarketsRegionIdHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/{region_id}/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List orders in a region
         * @description Return a list of orders in a region
         */
        get: operations["GetMarketsRegionIdOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/markets/{region_id}/types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List type IDs relevant to a market
         * @description Return a list of type IDs that have active orders in the region, for efficient market indexing.
         */
        get: operations["GetMarketsRegionIdTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/meta/changelog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get changelog
         * @description Get the changelog of this API.
         */
        get: operations["GetMetaChangelog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/meta/compatibility-dates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get compatibility dates
         * @description Get a list of compatibility dates.
         */
        get: operations["GetMetaCompatibilityDates"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/meta/name": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the name of ESI
         * @description Get the name ESI is currently going by, plus the full and glorious history of every name it has ever had. The three letters have never once meant the same thing twice.
         */
        get: operations["GetMetaName"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/meta/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get health status
         * @description Get the health status of each API route.
         */
        get: operations["GetMetaStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/military-campaigns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List military campaigns
         * @description Listing of all active military campaigns.
         */
        get: operations["GetMilitaryCampaignsListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/military-campaigns/{campaign_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get military campaign details
         * @description Get the details of a military campaign.
         */
        get: operations["GetMilitaryCampaignsDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/military-campaigns/{campaign_id}/objectives": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List military campaign objectives
         * @description Listing of all active, completed or expired objectives of a military campaign.
         */
        get: operations["GetMilitaryCampaignsObjectivesListing"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/military-campaigns/{campaign_id}/objectives/{objective_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get military campaign objective details
         * @description Get the details of an objective of a military campaign.
         */
        get: operations["GetMilitaryCampaignsObjectivesDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/paragon-hub/skinr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List public Paragon Hub SKINR listings
         * @description Browse the SKINR listings publicly available on the Paragon Hub.
         */
        get: operations["GetParagonHubSkinr"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/paragon-hub/skinr/alliances/{alliance_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Paragon Hub SKINR listings targeted at an alliance
         * @description Browse the SKINR listings on the Paragon Hub that are visible to the given alliance.
         */
        get: operations["GetParagonHubSkinrAlliances"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/paragon-hub/skinr/characters/{character_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Paragon Hub SKINR listings targeted at a character
         * @description Browse the SKINR listings on the Paragon Hub that are visible to the given character.
         */
        get: operations["GetParagonHubSkinrCharacters"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/paragon-hub/skinr/corporations/{corporation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List Paragon Hub SKINR listings targeted at a corporation
         * @description Browse the SKINR listings on the Paragon Hub that are visible to the given corporation.
         */
        get: operations["GetParagonHubSkinrCorporations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/route/{origin_system_id}/{destination_system_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get route between two systems
         * @description Calculate the systems between the given origin and destination.
         */
        post: operations["PostRoute"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/skyhooks/raidable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List (upcoming) raidable Skyhooks
         * @description Listing of all Skyhooks that currently or will shortly be raidable.
         */
        get: operations["GetSkyhooksRaidable"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sovereignty/campaigns": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List sovereignty campaigns
         * @description Shows sovereignty data for campaigns.
         */
        get: operations["GetSovereigntyCampaigns"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/sovereignty/systems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List sovereignty details for K-space systems
         * @description Listing of sovereignty details for all K-space systems in New Eden.
         */
        get: operations["GetSovereigntySystems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get the server's status
         * @description Current status of the EVE Online cluster
         */
        get: operations["GetStatus"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ui/autopilot/waypoint": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Set Autopilot Waypoint
         * @description Set a solar system as autopilot waypoint
         */
        post: operations["PostUiAutopilotWaypoint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ui/openwindow/contract": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open Contract Window
         * @description Open the contract window inside the client
         */
        post: operations["PostUiOpenwindowContract"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ui/openwindow/information": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open Information Window
         * @description Open the information window for a character, corporation or alliance inside the client
         */
        post: operations["PostUiOpenwindowInformation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ui/openwindow/marketdetails": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open Market Details
         * @description Open the market details window for a specific typeID inside the client
         */
        post: operations["PostUiOpenwindowMarketdetails"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/ui/openwindow/newmail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Open New Mail Window
         * @description Open the New Mail window, according to settings from the request if applicable
         */
        post: operations["PostUiOpenwindowNewmail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/ancestries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get ancestries
         * @description Get all character ancestries
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseAncestries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/asteroid_belts/{asteroid_belt_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get asteroid belt information
         * @description Get information on an asteroid belt
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseAsteroidBeltsAsteroidBeltId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/bloodlines": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get bloodlines
         * @description Get a list of bloodlines
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseBloodlines"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get item categories
         * @description Get a list of item categories
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseCategories"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/categories/{category_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get item category information
         * @description Get information of an item category
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseCategoriesCategoryId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/constellations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get constellations
         * @description Get a list of constellations
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseConstellations"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/constellations/{constellation_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get constellation information
         * @description Get information on a constellation
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseConstellationsConstellationId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/factions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get factions
         * @description Get a list of factions
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseFactions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/graphics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get graphics
         * @description Get a list of graphics
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseGraphics"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/graphics/{graphic_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get graphic information
         * @description Get information on a graphic
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseGraphicsGraphicId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get item groups
         * @description Get a list of item groups
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseGroups"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/groups/{group_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get item group information
         * @description Get information on an item group
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseGroupsGroupId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/ids": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Bulk names to IDs
         * @description Resolve a set of names to IDs in the following categories: agents, alliances, characters, constellations, corporations factions, inventory_types, regions, stations, and systems. Only exact matches will be returned. All names searched for are cached for 12 hours
         */
        post: operations["PostUniverseIds"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/moons/{moon_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get moon information
         * @description Get information on a moon
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseMoonsMoonId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/names": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Get names and categories for a set of IDs
         * @description Resolve a set of IDs to names and categories. Supported ID's for resolving are: Characters, Corporations, Alliances, Stations, Solar Systems, Constellations, Regions, Types, Factions
         */
        post: operations["PostUniverseNames"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/planets/{planet_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get planet information
         * @description Get information on a planet
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniversePlanetsPlanetId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/races": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get character races
         * @description Get a list of character races
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseRaces"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/regions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get regions
         * @description Get a list of regions
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseRegions"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/regions/{region_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get region information
         * @description Get information on a region
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseRegionsRegionId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/schematics/{schematic_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get schematic information
         * @description Get information on a planetary factory schematic
         */
        get: operations["GetUniverseSchematicsSchematicId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/stargates/{stargate_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get stargate information
         * @description Get information on a stargate
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseStargatesStargateId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/stars/{star_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get star information
         * @description Get information on a star
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseStarsStarId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/stations/{station_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get station information
         * @description Get information on a station
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseStationsStationId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/structures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List all public structures
         * @description List all public structures
         */
        get: operations["GetUniverseStructures"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/structures/{structure_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get structure information
         * @description Returns information on requested structure if you are on the ACL. Otherwise, returns "Forbidden" for all inputs.
         */
        get: operations["GetUniverseStructuresStructureId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/system_jumps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get system jumps
         * @description Get the number of jumps in solar systems within the last hour ending at the timestamp of the Last-Modified header, excluding wormhole space. Only systems with jumps will be listed
         */
        get: operations["GetUniverseSystemJumps"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/system_kills": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get system kills
         * @description Get the number of ship, pod and NPC kills per solar system within the last hour ending at the timestamp of the Last-Modified header, excluding wormhole space. Only systems with kills will be listed
         */
        get: operations["GetUniverseSystemKills"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/systems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get solar systems
         * @description Get a list of solar systems
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseSystems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/systems/{system_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get solar system information
         * @description Get information on a solar system.
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseSystemsSystemId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get types
         * @description Get a list of type ids
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseTypes"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/universe/types/{type_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get type information
         * @description Get information on a type
         *
         *     This route expires daily at 11:05
         */
        get: operations["GetUniverseTypesTypeId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/wars": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List wars
         * @description Return a list of wars
         */
        get: operations["GetWars"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/wars/{war_id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get war information
         * @description Return details about a war
         */
        get: operations["GetWarsWarId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/wars/{war_id}/killmails": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List kills for a war
         * @description Return a list of kills related to a war
         */
        get: operations["GetWarsWarIdKillmails"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /**
         * Format: int64
         * @example 1
         */
        AccessListID: number;
        AllianceDetail: {
            /** @description Alliance's creator corporation ID */
            creator_corporation_id: components["schemas"]["CorporationID"];
            /** @description Alliance's creator ID */
            creator_id: components["schemas"]["CharacterID"];
            /**
             * Format: date-time
             * @description Alliance's founding date
             */
            date_founded: string;
            /** @description Alliance's executor corporation ID */
            executor_corporation_id?: components["schemas"]["CorporationID"];
            /** @description Alliance's faction ID */
            faction_id?: components["schemas"]["FactionID"];
            /** @description Alliance's name */
            name: string;
            /** @description Alliance's ticker */
            ticker: string;
        };
        /**
         * Format: int64
         * @example 99000001
         */
        AllianceID: number;
        AlliancesAllianceIdContactsGet: {
            /** Format: int64 */
            contact_id: number;
            /** @enum {string} */
            contact_type: "character" | "corporation" | "alliance" | "faction";
            label_ids?: number[];
            /**
             * Format: double
             * @description Standing of the contact
             */
            standing: number;
        }[];
        AlliancesAllianceIdContactsLabelsGet: {
            /** Format: int64 */
            label_id: number;
            label_name: string;
        }[];
        AlliancesAllianceIdCorporationsGet: number[];
        AlliancesAllianceIdIconsGet: {
            px128x128?: string;
            px64x64?: string;
        };
        AlliancesGet: number[];
        /**
         * Format: int64
         * @example 33
         */
        ArchetypeID: number;
        /**
         * Format: int64
         * @example 209
         */
        AttributeID: number;
        /**
         * Format: int64
         * @example 1
         */
        BloodlineID: number;
        /**
         * Format: int64
         * @example 90000001
         */
        CharacterID: number;
        CharactersAccessListsDetail: {
            /** @description The Access List's description */
            description: string;
            /** @description The Access List's ID */
            id: components["schemas"]["AccessListID"];
            /** @description The Access List's membership */
            membership: components["schemas"]["CharactersAccessListsDetailMembership"];
            /** @description The Access List's name */
            name: string;
        };
        CharactersAccessListsDetailAllianceentry: {
            /**
             * @description Alliance's access
             * @enum {string}
             */
            access: "Unspecified" | "Allowed" | "Blocked" | "Manager" | "Admin";
            /** @description Alliance's ID */
            alliance_id: components["schemas"]["AllianceID"];
        };
        CharactersAccessListsDetailCharacterentry: {
            /**
             * @description Character's access
             * @enum {string}
             */
            access: "Unspecified" | "Allowed" | "Blocked" | "Manager" | "Admin";
            /** @description Character's ID */
            character_id: components["schemas"]["CharacterID"];
        };
        CharactersAccessListsDetailCorporationentry: {
            /**
             * @description Corporation's access
             * @enum {string}
             */
            access: "Unspecified" | "Allowed" | "Blocked" | "Manager" | "Admin";
            /** @description Corporation's ID */
            corporation_id: components["schemas"]["CorporationID"];
        };
        CharactersAccessListsDetailMembership: {
            /** @description Alliances in the Access List */
            alliances: components["schemas"]["CharactersAccessListsDetailAllianceentry"][];
            /** @description Whether everyone is allowed unless blocked */
            allow_everyone: boolean;
            /** @description Characters in the Access List */
            characters: components["schemas"]["CharactersAccessListsDetailCharacterentry"][];
            /** @description Corporations in the Access List */
            corporations: components["schemas"]["CharactersAccessListsDetailCorporationentry"][];
        };
        CharactersAccessListsListing: {
            /** @description List of Access Lists */
            access_lists: components["schemas"]["CharactersAccessListsListingAccesslist"][];
        };
        CharactersAccessListsListingAccesslist: {
            /** @description Access List's ID */
            id: components["schemas"]["AccessListID"];
        };
        CharactersAffiliationPost: {
            /**
             * Format: int64
             * @description The character's alliance ID, if their corporation is in an alliance
             */
            alliance_id?: number;
            /**
             * Format: int64
             * @description The character's ID
             */
            character_id: number;
            /**
             * Format: int64
             * @description The character's corporation ID
             */
            corporation_id: number;
            /**
             * Format: int64
             * @description The character's faction ID, if their corporation is in a faction
             */
            faction_id?: number;
        }[];
        CharactersCharacterIdAgentsResearchGet: {
            /** Format: int64 */
            agent_id: number;
            /** Format: double */
            points_per_day: number;
            /** Format: double */
            remainder_points: number;
            /** Format: int64 */
            skill_type_id: number;
            /** Format: date-time */
            started_at: string;
        }[];
        CharactersCharacterIdAssetsGet: {
            is_blueprint_copy?: boolean;
            is_singleton: boolean;
            /** Format: int64 */
            item_id: number;
            /** @enum {string} */
            location_flag: "AssetSafety" | "AutoFit" | "BoosterBay" | "CapsuleerDeliveries" | "Cargo" | "CorporationGoalDeliveries" | "CorpseBay" | "Deliveries" | "DroneBay" | "ExpeditionHold" | "FighterBay" | "FighterTube0" | "FighterTube1" | "FighterTube2" | "FighterTube3" | "FighterTube4" | "FleetHangar" | "FrigateEscapeBay" | "Hangar" | "HangarAll" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "HiddenModifiers" | "Implant" | "InfrastructureHangar" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "Locked" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "MobileDepotHold" | "MoonMaterialBay" | "QuafeBay" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "RigSlot3" | "RigSlot4" | "RigSlot5" | "RigSlot6" | "RigSlot7" | "ShipHangar" | "Skill" | "SpecializedAmmoHold" | "SpecializedAsteroidHold" | "SpecializedCommandCenterHold" | "SpecializedFuelBay" | "SpecializedGasHold" | "SpecializedIceHold" | "SpecializedIndustrialShipHold" | "SpecializedLargeShipHold" | "SpecializedMaterialBay" | "SpecializedMediumShipHold" | "SpecializedMineralHold" | "SpecializedOreHold" | "SpecializedPlanetaryCommoditiesHold" | "SpecializedSalvageHold" | "SpecializedShipHold" | "SpecializedSmallShipHold" | "StructureDeedBay" | "SubSystemBay" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3" | "SubSystemSlot4" | "SubSystemSlot5" | "SubSystemSlot6" | "SubSystemSlot7" | "Unlocked" | "Wardrobe";
            /** Format: int64 */
            location_id: number;
            /** @enum {string} */
            location_type: "station" | "solar_system" | "item" | "other";
            /** Format: int64 */
            quantity: number;
            /** Format: int64 */
            type_id: number;
        }[];
        CharactersCharacterIdAssetsLocationsPost: {
            /** Format: int64 */
            item_id: number;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
        }[];
        CharactersCharacterIdAssetsNamesPost: {
            /** Format: int64 */
            item_id: number;
            name: string;
        }[];
        CharactersCharacterIdAttributesGet: {
            /**
             * Format: date-time
             * @description Neural remapping cooldown after a character uses remap accrued over time
             */
            accrued_remap_cooldown_date?: string;
            /**
             * Format: int64
             * @description Number of available bonus character neural remaps
             */
            bonus_remaps?: number;
            /** Format: int64 */
            charisma: number;
            /** Format: int64 */
            intelligence: number;
            /**
             * Format: date-time
             * @description Datetime of last neural remap, including usage of bonus remaps
             */
            last_remap_date?: string;
            /** Format: int64 */
            memory: number;
            /** Format: int64 */
            perception: number;
            /** Format: int64 */
            willpower: number;
        };
        CharactersCharacterIdBlueprintsGet: {
            /**
             * Format: int64
             * @description Unique ID for this item.
             */
            item_id: number;
            /**
             * @description Type of the location_id
             * @enum {string}
             */
            location_flag: "AutoFit" | "Cargo" | "CorpseBay" | "DroneBay" | "FleetHangar" | "Deliveries" | "HiddenModifiers" | "Hangar" | "HangarAll" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "AssetSafety" | "Locked" | "Unlocked" | "Implant" | "QuafeBay" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "RigSlot3" | "RigSlot4" | "RigSlot5" | "RigSlot6" | "RigSlot7" | "ShipHangar" | "SpecializedFuelBay" | "SpecializedOreHold" | "SpecializedGasHold" | "SpecializedMineralHold" | "SpecializedSalvageHold" | "SpecializedShipHold" | "SpecializedSmallShipHold" | "SpecializedMediumShipHold" | "SpecializedLargeShipHold" | "SpecializedIndustrialShipHold" | "SpecializedAmmoHold" | "SpecializedCommandCenterHold" | "SpecializedPlanetaryCommoditiesHold" | "SpecializedMaterialBay" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3" | "SubSystemSlot4" | "SubSystemSlot5" | "SubSystemSlot6" | "SubSystemSlot7" | "FighterBay" | "FighterTube0" | "FighterTube1" | "FighterTube2" | "FighterTube3" | "FighterTube4" | "Module";
            /**
             * Format: int64
             * @description References a station, a ship or an item_id if this blueprint is located within a container. If the return value is an item_id, then the Character AssetList API must be queried to find the container using the given item_id to determine the correct location of the Blueprint.
             */
            location_id: number;
            /**
             * Format: int64
             * @description Material Efficiency Level of the blueprint.
             */
            material_efficiency: number;
            /**
             * Format: int64
             * @description A range of numbers with a minimum of -2 and no maximum value where -1 is an original and -2 is a copy. It can be a positive integer if it is a stack of blueprint originals fresh from the market (e.g. no activities performed on them yet).
             */
            quantity: number;
            /**
             * Format: int64
             * @description Number of runs remaining if the blueprint is a copy, -1 if it is an original.
             */
            runs: number;
            /**
             * Format: int64
             * @description Time Efficiency Level of the blueprint.
             */
            time_efficiency: number;
            /** Format: int64 */
            type_id: number;
        }[];
        /** @description List of attendees for a given event */
        CharactersCharacterIdCalendarEventIdAttendeesGet: {
            /** Format: int64 */
            character_id?: number;
            /** @enum {string} */
            event_response?: "declined" | "not_responded" | "accepted" | "tentative";
        }[];
        /** @description Full details of a specific event */
        CharactersCharacterIdCalendarEventIdGet: {
            /** Format: date-time */
            date: string;
            /**
             * Format: int64
             * @description Length in minutes
             */
            duration: number;
            /** Format: int64 */
            event_id: number;
            /** Format: int64 */
            importance: number;
            /** Format: int64 */
            owner_id: number;
            owner_name: string;
            /** @enum {string} */
            owner_type: "eve_server" | "corporation" | "faction" | "character" | "alliance";
            response: string;
            text: string;
            title: string;
        };
        /** @description Up to 50 events from now or the event you requested */
        CharactersCharacterIdCalendarGet: {
            /** Format: date-time */
            event_date?: string;
            /** Format: int64 */
            event_id?: number;
            /** @enum {string} */
            event_response?: "declined" | "not_responded" | "accepted" | "tentative";
            /** Format: int64 */
            importance?: number;
            title?: string;
        }[];
        CharactersCharacterIdClonesGet: {
            home_location?: {
                /** Format: int64 */
                location_id?: number;
                /** @enum {string} */
                location_type?: "station" | "structure";
            };
            jump_clones: {
                implants: number[];
                /** Format: int64 */
                jump_clone_id: number;
                /** Format: int64 */
                location_id: number;
                /** @enum {string} */
                location_type: "station" | "structure";
                name?: string;
            }[];
            /** Format: date-time */
            last_clone_jump_date?: string;
            /** Format: date-time */
            last_station_change_date?: string;
        };
        CharactersCharacterIdContactsGet: {
            /** Format: int64 */
            contact_id: number;
            /** @enum {string} */
            contact_type: "character" | "corporation" | "alliance" | "faction";
            /** @description Whether this contact is in the blocked list. Note a missing value denotes unknown, not true or false */
            is_blocked?: boolean;
            /** @description Whether this contact is being watched */
            is_watched?: boolean;
            label_ids?: number[];
            /**
             * Format: double
             * @description Standing of the contact
             */
            standing: number;
        }[];
        CharactersCharacterIdContactsLabelsGet: {
            /** Format: int64 */
            label_id: number;
            label_name: string;
        }[];
        /** @description 201 created array */
        CharactersCharacterIdContactsPost: number[];
        CharactersCharacterIdContractsContractIdBidsGet: {
            /**
             * Format: double
             * @description The amount bid, in ISK
             */
            amount: number;
            /**
             * Format: int64
             * @description Unique ID for the bid
             */
            bid_id: number;
            /**
             * Format: int64
             * @description Character ID of the bidder
             */
            bidder_id: number;
            /**
             * Format: date-time
             * @description Datetime when the bid was placed
             */
            date_bid: string;
        }[];
        CharactersCharacterIdContractsContractIdItemsGet: {
            /** @description true if the contract issuer has submitted this item with the contract, false if the isser is asking for this item in the contract */
            is_included: boolean;
            is_singleton: boolean;
            /**
             * Format: int64
             * @description Number of items in the stack
             */
            quantity: number;
            /**
             * Format: int64
             * @description -1 indicates that the item is a singleton (non-stackable). If the item happens to be a Blueprint, -1 is an Original and -2 is a Blueprint Copy
             */
            raw_quantity?: number;
            /**
             * Format: int64
             * @description Unique ID for the item
             */
            record_id: number;
            /**
             * Format: int64
             * @description Type ID for item
             */
            type_id: number;
        }[];
        CharactersCharacterIdContractsGet: {
            /**
             * Format: int64
             * @description Who will accept the contract
             */
            acceptor_id: number;
            /**
             * Format: int64
             * @description ID to whom the contract is assigned, can be alliance, corporation or character ID
             */
            assignee_id: number;
            /**
             * @description To whom the contract is available
             * @enum {string}
             */
            availability: "public" | "personal" | "corporation" | "alliance";
            /**
             * Format: double
             * @description Buyout price (for Auctions only)
             */
            buyout?: number;
            /**
             * Format: double
             * @description Collateral price (for Couriers only)
             */
            collateral?: number;
            /** Format: int64 */
            contract_id: number;
            /**
             * Format: date-time
             * @description Date of confirmation of contract
             */
            date_accepted?: string;
            /**
             * Format: date-time
             * @description Date of completed of contract
             */
            date_completed?: string;
            /**
             * Format: date-time
             * @description Expiration date of the contract
             */
            date_expired: string;
            /**
             * Format: date-time
             * @description Сreation date of the contract
             */
            date_issued: string;
            /**
             * Format: int64
             * @description Number of days to perform the contract
             */
            days_to_complete?: number;
            /**
             * Format: int64
             * @description End location ID (for Couriers contract)
             */
            end_location_id?: number;
            /** @description true if the contract was issued on behalf of the issuer's corporation */
            for_corporation: boolean;
            /**
             * Format: int64
             * @description Character's corporation ID for the issuer
             */
            issuer_corporation_id: number;
            /**
             * Format: int64
             * @description Character ID for the issuer
             */
            issuer_id: number;
            /**
             * Format: double
             * @description Price of contract (for ItemsExchange and Auctions)
             */
            price?: number;
            /**
             * Format: double
             * @description Remuneration for contract (for Couriers only)
             */
            reward?: number;
            /**
             * Format: int64
             * @description Start location ID (for Couriers contract)
             */
            start_location_id?: number;
            /**
             * @description Status of the the contract
             * @enum {string}
             */
            status: "outstanding" | "in_progress" | "finished_issuer" | "finished_contractor" | "finished" | "cancelled" | "rejected" | "failed" | "deleted" | "reversed";
            /** @description Title of the contract */
            title?: string;
            /**
             * @description Type of the contract
             * @enum {string}
             */
            type: "unknown" | "item_exchange" | "auction" | "courier" | "loan";
            /**
             * Format: double
             * @description Volume of items in the contract
             */
            volume?: number;
        }[];
        CharactersCharacterIdCorporationhistoryGet: {
            /** Format: int64 */
            corporation_id: number;
            /** @description True if the corporation has been deleted */
            is_deleted?: boolean;
            /**
             * Format: int64
             * @description An incrementing ID that can be used to canonically establish order of records in cases where dates may be ambiguous
             */
            record_id: number;
            /** Format: date-time */
            start_date: string;
        }[];
        /**
         * Format: double
         * @description 201 created number
         */
        CharactersCharacterIdCspaPost: number;
        CharactersCharacterIdFatigueGet: {
            /**
             * Format: date-time
             * @description Character's jump fatigue expiry
             */
            jump_fatigue_expire_date?: string;
            /**
             * Format: date-time
             * @description Character's last jump activation
             */
            last_jump_date?: string;
            /**
             * Format: date-time
             * @description Character's last jump update
             */
            last_update_date?: string;
        };
        CharactersCharacterIdFittingsGet: {
            description: string;
            /** Format: int64 */
            fitting_id: number;
            items: {
                /** @enum {string} */
                flag: "Cargo" | "DroneBay" | "FighterBay" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "Invalid" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "ServiceSlot0" | "ServiceSlot1" | "ServiceSlot2" | "ServiceSlot3" | "ServiceSlot4" | "ServiceSlot5" | "ServiceSlot6" | "ServiceSlot7" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3";
                /** Format: int64 */
                quantity: number;
                /** Format: int64 */
                type_id: number;
            }[];
            name: string;
            /** Format: int64 */
            ship_type_id: number;
        }[];
        /** @description 201 created object */
        CharactersCharacterIdFittingsPost: {
            /** Format: int64 */
            fitting_id: number;
        };
        CharactersCharacterIdFleetGet: {
            /**
             * Format: int64
             * @description Character ID of the current fleet boss
             */
            fleet_boss_id: number;
            /**
             * Format: int64
             * @description The character's current fleet ID
             */
            fleet_id: number;
            /**
             * @description Member’s role in fleet
             * @enum {string}
             */
            role: "fleet_commander" | "squad_commander" | "squad_member" | "wing_commander";
            /**
             * Format: int64
             * @description ID of the squad the member is in. If not applicable, will be set to -1
             */
            squad_id: number;
            /**
             * Format: int64
             * @description ID of the wing the member is in. If not applicable, will be set to -1
             */
            wing_id: number;
        };
        CharactersCharacterIdFwStatsGet: {
            /**
             * Format: int64
             * @description The given character's current faction rank
             */
            current_rank?: number;
            /**
             * Format: date-time
             * @description The enlistment date of the given character into faction warfare. Will not be included if character is not enlisted in faction warfare
             */
            enlisted_on?: string;
            /**
             * Format: int64
             * @description The faction the given character is enlisted to fight for. Will not be included if character is not enlisted in faction warfare
             */
            faction_id?: number;
            /**
             * Format: int64
             * @description The given character's highest faction rank achieved
             */
            highest_rank?: number;
            /** @description Summary of kills done by the given character against enemy factions */
            kills: {
                /**
                 * Format: int64
                 * @description Last week's total number of kills by a given character against enemy factions
                 */
                last_week: number;
                /**
                 * Format: int64
                 * @description Total number of kills by a given character against enemy factions since the character enlisted
                 */
                total: number;
                /**
                 * Format: int64
                 * @description Yesterday's total number of kills by a given character against enemy factions
                 */
                yesterday: number;
            };
            /** @description Summary of victory points gained by the given character for the enlisted faction */
            victory_points: {
                /**
                 * Format: int64
                 * @description Last week's victory points gained by the given character
                 */
                last_week: number;
                /**
                 * Format: int64
                 * @description Total victory points gained since the given character enlisted
                 */
                total: number;
                /**
                 * Format: int64
                 * @description Yesterday's victory points gained by the given character
                 */
                yesterday: number;
            };
        };
        CharactersCharacterIdImplantsGet: number[];
        CharactersCharacterIdIndustryJobsGet: {
            /**
             * Format: int64
             * @description Job activity ID
             */
            activity_id: number;
            /** Format: int64 */
            blueprint_id: number;
            /**
             * Format: int64
             * @description Location ID of the location from which the blueprint was installed. Normally a station ID, but can also be an asset (e.g. container) or corporation facility
             */
            blueprint_location_id: number;
            /** Format: int64 */
            blueprint_type_id: number;
            /**
             * Format: int64
             * @description ID of the character which completed this job
             */
            completed_character_id?: number;
            /**
             * Format: date-time
             * @description Date and time when this job was completed
             */
            completed_date?: string;
            /**
             * Format: double
             * @description The sume of job installation fee and industry facility tax
             */
            cost?: number;
            /**
             * Format: int64
             * @description Job duration in seconds
             */
            duration: number;
            /**
             * Format: date-time
             * @description Date and time when this job finished
             */
            end_date: string;
            /**
             * Format: int64
             * @description ID of the facility where this job is running
             */
            facility_id: number;
            /**
             * Format: int64
             * @description ID of the character which installed this job
             */
            installer_id: number;
            /**
             * Format: int64
             * @description Unique job ID
             */
            job_id: number;
            /**
             * Format: int64
             * @description Number of runs blueprint is licensed for
             */
            licensed_runs?: number;
            /**
             * Format: int64
             * @description Location ID of the location to which the output of the job will be delivered. Normally a station ID, but can also be a corporation facility
             */
            output_location_id: number;
            /**
             * Format: date-time
             * @description Date and time when this job was paused (i.e. time when the facility where this job was installed went offline)
             */
            pause_date?: string;
            /**
             * Format: double
             * @description Chance of success for invention
             */
            probability?: number;
            /**
             * Format: int64
             * @description Type ID of product (manufactured, copied or invented)
             */
            product_type_id?: number;
            /**
             * Format: int64
             * @description Number of runs for a manufacturing job, or number of copies to make for a blueprint copy
             */
            runs: number;
            /**
             * Format: date-time
             * @description Date and time when this job started
             */
            start_date: string;
            /**
             * Format: int64
             * @description ID of the station where industry facility is located
             */
            station_id: number;
            /** @enum {string} */
            status: "active" | "cancelled" | "delivered" | "paused" | "ready" | "reverted";
            /**
             * Format: int64
             * @description Number of successful runs for this job. Equal to runs unless this is an invention job
             */
            successful_runs?: number;
        }[];
        CharactersCharacterIdKillmailsRecentGet: {
            /** @description A hash of this killmail */
            killmail_hash: string;
            /**
             * Format: int64
             * @description ID of this killmail
             */
            killmail_id: number;
        }[];
        CharactersCharacterIdLoyaltyPointsGet: {
            /** Format: int64 */
            corporation_id: number;
            /** Format: int64 */
            loyalty_points: number;
        }[];
        CharactersCharacterIdMailGet: {
            /**
             * Format: int64
             * @description From whom the mail was sent
             */
            from?: number;
            is_read?: boolean;
            labels?: number[];
            /** Format: int64 */
            mail_id?: number;
            /** @description Recipients of the mail */
            recipients?: {
                /** Format: int64 */
                recipient_id: number;
                /** @enum {string} */
                recipient_type: "alliance" | "character" | "corporation" | "mailing_list";
            }[];
            /** @description Mail subject */
            subject?: string;
            /**
             * Format: date-time
             * @description When the mail was sent
             */
            timestamp?: string;
        }[];
        CharactersCharacterIdMailLabelsGet: {
            labels?: {
                /**
                 * @default #ffffff
                 * @enum {string}
                 */
                color: "#0000fe" | "#006634" | "#0099ff" | "#00ff33" | "#01ffff" | "#349800" | "#660066" | "#666666" | "#999999" | "#99ffff" | "#9a0000" | "#ccff9a" | "#e6e6e6" | "#fe0000" | "#ff6600" | "#ffff01" | "#ffffcd" | "#ffffff";
                /** Format: int64 */
                label_id?: number;
                name?: string;
                /** Format: int64 */
                unread_count?: number;
            }[];
            /** Format: int64 */
            total_unread_count?: number;
        };
        /**
         * Format: int64
         * @description Label ID
         */
        CharactersCharacterIdMailLabelsPost: number;
        CharactersCharacterIdMailListsGet: {
            /**
             * Format: int64
             * @description Mailing list ID
             */
            mailing_list_id: number;
            name: string;
        }[];
        CharactersCharacterIdMailMailIdGet: {
            /** @description Mail's body */
            body?: string;
            /**
             * Format: int64
             * @description From whom the mail was sent
             */
            from?: number;
            /** @description Labels attached to the mail */
            labels?: number[];
            /** @description Whether the mail is flagged as read */
            read?: boolean;
            /** @description Recipients of the mail */
            recipients?: {
                /** Format: int64 */
                recipient_id: number;
                /** @enum {string} */
                recipient_type: "alliance" | "character" | "corporation" | "mailing_list";
            }[];
            /** @description Mail subject */
            subject?: string;
            /**
             * Format: date-time
             * @description When the mail was sent
             */
            timestamp?: string;
        };
        /**
         * Format: int64
         * @description Mail ID
         */
        CharactersCharacterIdMailPost: number;
        CharactersCharacterIdMedalsGet: {
            /** Format: int64 */
            corporation_id: number;
            /** Format: date-time */
            date: string;
            description: string;
            graphics: {
                /** Format: int64 */
                color?: number;
                graphic: string;
                /** Format: int64 */
                layer: number;
                /** Format: int64 */
                part: number;
            }[];
            /** Format: int64 */
            issuer_id: number;
            /** Format: int64 */
            medal_id: number;
            reason: string;
            /** @enum {string} */
            status: "public" | "private";
            title: string;
        }[];
        CharactersCharacterIdMiningGet: {
            /** Format: date */
            date: string;
            /** Format: int64 */
            quantity: number;
            /** Format: int64 */
            solar_system_id: number;
            /** Format: int64 */
            type_id: number;
        }[];
        CharactersCharacterIdNotificationsContactsGet: {
            message: string;
            /** Format: int64 */
            notification_id: number;
            /** Format: date-time */
            send_date: string;
            /** Format: int64 */
            sender_character_id: number;
            /**
             * Format: double
             * @description A number representing the standing level the receiver has been added at by the sender. The standing levels are as follows: -10 -> Terrible | -5 -> Bad |  0 -> Neutral |  5 -> Good |  10 -> Excellent
             */
            standing_level: number;
        }[];
        CharactersCharacterIdNotificationsGet: {
            is_read?: boolean;
            /** Format: int64 */
            notification_id: number;
            /** Format: int64 */
            sender_id: number;
            /** @enum {string} */
            sender_type: "character" | "corporation" | "alliance" | "faction" | "other";
            text?: string;
            /** Format: date-time */
            timestamp: string;
            /** @enum {string} */
            type: "AcceptedAlly" | "AcceptedSurrender" | "AgentRetiredTrigravian" | "AllAnchoringMsg" | "AllMaintenanceBillMsg" | "AllStrucInvulnerableMsg" | "AllStructVulnerableMsg" | "AllWarCorpJoinedAllianceMsg" | "AllWarDeclaredMsg" | "AllWarInvalidatedMsg" | "AllWarRetractedMsg" | "AllWarSurrenderMsg" | "AllianceCapitalChanged" | "AllianceWarDeclaredV2" | "AllyContractCancelled" | "AllyJoinedWarAggressorMsg" | "AllyJoinedWarAllyMsg" | "AllyJoinedWarDefenderMsg" | "BattlePunishFriendlyFire" | "BillOutOfMoneyMsg" | "BillPaidCorpAllMsg" | "BountyClaimMsg" | "BountyESSShared" | "BountyESSTaken" | "BountyPlacedAlliance" | "BountyPlacedChar" | "BountyPlacedCorp" | "BountyYourBountyClaimed" | "BuddyConnectContactAdd" | "CharAppAcceptMsg" | "CharAppRejectMsg" | "CharAppWithdrawMsg" | "CharLeftCorpMsg" | "CharMedalMsg" | "CharTerminationMsg" | "CloneActivationMsg" | "CloneActivationMsg2" | "CloneMovedMsg" | "CloneRevokedMsg1" | "CloneRevokedMsg2" | "CombatOperationFinished" | "ContactAdd" | "ContactEdit" | "ContainerPasswordMsg" | "ContractRegionChangedToPochven" | "CorpAllBillMsg" | "CorpAppAcceptMsg" | "CorpAppInvitedMsg" | "CorpAppNewMsg" | "CorpAppRejectCustomMsg" | "CorpAppRejectMsg" | "CorpBecameWarEligible" | "CorpDividendMsg" | "CorpFriendlyFireDisableTimerCompleted" | "CorpFriendlyFireDisableTimerStarted" | "CorpFriendlyFireEnableTimerCompleted" | "CorpFriendlyFireEnableTimerStarted" | "CorpKicked" | "CorpLiquidationMsg" | "CorpNewCEOMsg" | "CorpNewsMsg" | "CorpNoLongerWarEligible" | "CorpOfficeExpirationMsg" | "CorpStructLostMsg" | "CorpTaxChangeMsg" | "CorpVoteCEORevokedMsg" | "CorpVoteMsg" | "CorpWarDeclaredMsg" | "CorpWarDeclaredV2" | "CorpWarFightingLegalMsg" | "CorpWarInvalidatedMsg" | "CorpWarRetractedMsg" | "CorpWarSurrenderMsg" | "CorporationGoalClosed" | "CorporationGoalCompleted" | "CorporationGoalCreated" | "CorporationGoalExpired" | "CorporationGoalLimitReached" | "CorporationGoalNameChange" | "CorporationLeft" | "CustomsMsg" | "DailyItemRewardAutoClaimed" | "DeclareWar" | "DistrictAttacked" | "DustAppAcceptedMsg" | "ESSMainBankLink" | "EntosisCaptureStarted" | "ExpertSystemExpired" | "ExpertSystemExpiryImminent" | "FWAllianceKickCeoIndividualStandingWarning" | "FWAllianceKickMsg" | "FWAllianceKickedCeoIndividualStanding" | "FWAllianceWarningMsg" | "FWCharKickMsg" | "FWCharRankGainMsg" | "FWCharRankLossMsg" | "FWCharWarningMsg" | "FWCharacterKickFromCorpIndividualStandingWarning" | "FWCharacterKickedFromCorpIndividualStanding" | "FWCorpJoinMsg" | "FWCorpKickMsg" | "FWCorpLeaveMsg" | "FWCorpWarningMsg" | "FWCorporationKickCeoIndividualStandingWarning" | "FWCorporationKickedCeoIndividualStanding" | "FacWarCorpJoinRequestMsg" | "FacWarCorpJoinWithdrawMsg" | "FacWarCorpLeaveRequestMsg" | "FacWarCorpLeaveWithdrawMsg" | "FacWarDirectEnlistmentRevoked" | "FacWarLPDisqualifiedEvent" | "FacWarLPDisqualifiedKill" | "FacWarLPPayoutEvent" | "FacWarLPPayoutKill" | "FreelanceProjectACLDeleted" | "FreelanceProjectClosed" | "FreelanceProjectCompleted" | "FreelanceProjectCreated" | "FreelanceProjectExpired" | "FreelanceProjectLimitReached" | "FreelanceProjectParticipantKicked" | "GameTimeAdded" | "GameTimeReceived" | "GameTimeSent" | "GiftReceived" | "IHubDestroyedByBillFailure" | "IncursionCompletedMsg" | "IndustryOperationFinished" | "IndustryTeamAuctionLost" | "IndustryTeamAuctionWon" | "InfrastructureHubBillAboutToExpire" | "InsuranceExpirationMsg" | "InsuranceFirstShipMsg" | "InsuranceInvalidatedMsg" | "InsuranceIssuedMsg" | "InsurancePayoutMsg" | "InvasionCompletedMsg" | "InvasionSystemLogin" | "InvasionSystemStart" | "JumpCloneDeletedMsg1" | "JumpCloneDeletedMsg2" | "KillReportFinalBlow" | "KillReportVictim" | "KillRightAvailable" | "KillRightAvailableOpen" | "KillRightEarned" | "KillRightUnavailable" | "KillRightUnavailableOpen" | "KillRightUsed" | "LPAutoRedeemed" | "LocateCharMsg" | "MadeWarMutual" | "MercOfferRetractedMsg" | "MercOfferedNegotiationMsg" | "MercenaryDenAttacked" | "MercenaryDenNewMTO" | "MercenaryDenReinforced" | "MissionCanceledTriglavian" | "MissionOfferExpirationMsg" | "MissionTimeoutMsg" | "MoonminingAutomaticFracture" | "MoonminingExtractionCancelled" | "MoonminingExtractionFinished" | "MoonminingExtractionStarted" | "MoonminingLaserFired" | "MutualWarExpired" | "MutualWarInviteAccepted" | "MutualWarInviteRejected" | "MutualWarInviteSent" | "NPCStandingsGained" | "NPCStandingsLost" | "OfferToAllyRetracted" | "OfferedSurrender" | "OfferedToAlly" | "OfficeLeaseCanceledInsufficientStandings" | "OldLscMessages" | "OperationFinished" | "OrbitalAttacked" | "OrbitalReinforced" | "OwnershipTransferred" | "RaffleCreated" | "RaffleExpired" | "RaffleFinished" | "ReimbursementMsg" | "ResearchMissionAvailableMsg" | "RetractsWar" | "SPAutoRedeemed" | "SeasonalChallengeCompleted" | "SkinSequencingCompleted" | "SkyhookDeployed" | "SkyhookDestroyed" | "SkyhookLostShields" | "SkyhookOnline" | "SkyhookUnderAttack" | "SovAllClaimAquiredMsg" | "SovAllClaimLostMsg" | "SovCommandNodeEventStarted" | "SovCorpBillLateMsg" | "SovCorpClaimFailMsg" | "SovDisruptorMsg" | "SovStationEnteredFreeport" | "SovStructureDestroyed" | "SovStructureReinforced" | "SovStructureSelfDestructCancel" | "SovStructureSelfDestructFinished" | "SovStructureSelfDestructRequested" | "SovereigntyIHDamageMsg" | "SovereigntySBUDamageMsg" | "SovereigntyTCUDamageMsg" | "StationAggressionMsg1" | "StationAggressionMsg2" | "StationConquerMsg" | "StationServiceDisabled" | "StationServiceEnabled" | "StationStateChangeMsg" | "StoryLineMissionAvailableMsg" | "StructureAnchoring" | "StructureCourierContractChanged" | "StructureDestroyed" | "StructureFuelAlert" | "StructureImpendingAbandonmentAssetsAtRisk" | "StructureItemsDelivered" | "StructureItemsMovedToSafety" | "StructureLostArmor" | "StructureLostShields" | "StructureLowReagentsAlert" | "StructureNoReagentsAlert" | "StructureOnline" | "StructurePaintPurchased" | "StructureServicesOffline" | "StructureUnanchoring" | "StructureUnderAttack" | "StructureWentHighPower" | "StructureWentLowPower" | "StructuresJobsCancelled" | "StructuresJobsPaused" | "StructuresReinforcementChanged" | "TowerAlertMsg" | "TowerResourceAlertMsg" | "TransactionReversalMsg" | "TutorialMsg" | "WarAdopted " | "WarAllyInherited" | "WarAllyOfferDeclinedMsg" | "WarConcordInvalidates" | "WarDeclared" | "WarEndedHqSecurityDrop" | "WarHQRemovedFromSpace" | "WarInherited" | "WarInvalid" | "WarRetracted" | "WarRetractedByConcord" | "WarSurrenderDeclinedMsg" | "WarSurrenderOfferMsg";
        }[];
        CharactersCharacterIdOrdersGet: {
            /**
             * Format: int64
             * @description Number of days for which order is valid (starting from the issued date). An order expires at time issued + duration
             */
            duration: number;
            /**
             * Format: double
             * @description For buy orders, the amount of ISK in escrow
             */
            escrow?: number;
            /** @description True if the order is a bid (buy) order */
            is_buy_order?: boolean;
            /** @description Signifies whether the buy/sell order was placed on behalf of a corporation. */
            is_corporation: boolean;
            /**
             * Format: date-time
             * @description Date and time when this order was issued
             */
            issued: string;
            /**
             * Format: int64
             * @description ID of the location where order was placed
             */
            location_id: number;
            /**
             * Format: int64
             * @description For buy orders, the minimum quantity that will be accepted in a matching sell order
             */
            min_volume?: number;
            /**
             * Format: int64
             * @description Unique order ID
             */
            order_id: number;
            /**
             * Format: double
             * @description Cost per unit for this order
             */
            price: number;
            /**
             * @description Valid order range, numbers are ranges in jumps
             * @enum {string}
             */
            range: "1" | "10" | "2" | "20" | "3" | "30" | "4" | "40" | "5" | "region" | "solarsystem" | "station";
            /**
             * Format: int64
             * @description ID of the region where order was placed
             */
            region_id: number;
            /**
             * Format: int64
             * @description The type ID of the item transacted in this order
             */
            type_id: number;
            /**
             * Format: int64
             * @description Quantity of items still required or offered
             */
            volume_remain: number;
            /**
             * Format: int64
             * @description Quantity of items required or offered at time order was placed
             */
            volume_total: number;
        }[];
        CharactersCharacterIdOrdersHistoryGet: {
            /**
             * Format: int64
             * @description Number of days the order was valid for (starting from the issued date). An order expires at time issued + duration
             */
            duration: number;
            /**
             * Format: double
             * @description For buy orders, the amount of ISK in escrow
             */
            escrow?: number;
            /** @description True if the order is a bid (buy) order */
            is_buy_order?: boolean;
            /** @description Signifies whether the buy/sell order was placed on behalf of a corporation. */
            is_corporation: boolean;
            /**
             * Format: date-time
             * @description Date and time when this order was issued
             */
            issued: string;
            /**
             * Format: int64
             * @description ID of the location where order was placed
             */
            location_id: number;
            /**
             * Format: int64
             * @description For buy orders, the minimum quantity that will be accepted in a matching sell order
             */
            min_volume?: number;
            /**
             * Format: int64
             * @description Unique order ID
             */
            order_id: number;
            /**
             * Format: double
             * @description Cost per unit for this order
             */
            price: number;
            /**
             * @description Valid order range, numbers are ranges in jumps
             * @enum {string}
             */
            range: "1" | "10" | "2" | "20" | "3" | "30" | "4" | "40" | "5" | "region" | "solarsystem" | "station";
            /**
             * Format: int64
             * @description ID of the region where order was placed
             */
            region_id: number;
            /**
             * @description Current order state
             * @enum {string}
             */
            state: "cancelled" | "expired";
            /**
             * Format: int64
             * @description The type ID of the item transacted in this order
             */
            type_id: number;
            /**
             * Format: int64
             * @description Quantity of items still required or offered
             */
            volume_remain: number;
            /**
             * Format: int64
             * @description Quantity of items required or offered at time order was placed
             */
            volume_total: number;
        }[];
        CharactersCharacterIdPlanetsGet: {
            /** Format: date-time */
            last_update: string;
            /** Format: int64 */
            num_pins: number;
            /** Format: int64 */
            owner_id: number;
            /** Format: int64 */
            planet_id: number;
            /** @enum {string} */
            planet_type: "temperate" | "barren" | "oceanic" | "ice" | "gas" | "lava" | "storm" | "plasma";
            /** Format: int64 */
            solar_system_id: number;
            /** Format: int64 */
            upgrade_level: number;
        }[];
        CharactersCharacterIdPlanetsPlanetIdGet: {
            links: {
                /** Format: int64 */
                destination_pin_id: number;
                /** Format: int64 */
                link_level: number;
                /** Format: int64 */
                source_pin_id: number;
            }[];
            pins: {
                contents?: {
                    /** Format: int64 */
                    amount: number;
                    /** Format: int64 */
                    type_id: number;
                }[];
                /** Format: date-time */
                expiry_time?: string;
                extractor_details?: {
                    /**
                     * Format: int64
                     * @description in seconds
                     */
                    cycle_time?: number;
                    /** Format: double */
                    head_radius?: number;
                    heads: {
                        /** Format: int64 */
                        head_id: number;
                        /** Format: double */
                        latitude: number;
                        /** Format: double */
                        longitude: number;
                    }[];
                    /** Format: int64 */
                    product_type_id?: number;
                    /** Format: int64 */
                    qty_per_cycle?: number;
                };
                factory_details?: {
                    /** Format: int64 */
                    schematic_id: number;
                };
                /** Format: date-time */
                install_time?: string;
                /** Format: date-time */
                last_cycle_start?: string;
                /** Format: double */
                latitude: number;
                /** Format: double */
                longitude: number;
                /** Format: int64 */
                pin_id: number;
                /** Format: int64 */
                schematic_id?: number;
                /** Format: int64 */
                type_id: number;
            }[];
            routes: {
                /** Format: int64 */
                content_type_id: number;
                /** Format: int64 */
                destination_pin_id: number;
                /** Format: double */
                quantity: number;
                /** Format: int64 */
                route_id: number;
                /** Format: int64 */
                source_pin_id: number;
                /** @description list of pin ID waypoints */
                waypoints?: number[];
            }[];
        };
        CharactersCharacterIdPortraitGet: {
            px128x128?: string;
            px256x256?: string;
            px512x512?: string;
            px64x64?: string;
        };
        CharactersCharacterIdRolesGet: {
            roles?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_base?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_hq?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_other?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
        };
        CharactersCharacterIdSearchGet: {
            agent?: number[];
            alliance?: number[];
            character?: number[];
            constellation?: number[];
            corporation?: number[];
            faction?: number[];
            inventory_type?: number[];
            region?: number[];
            solar_system?: number[];
            station?: number[];
            structure?: number[];
        };
        CharactersCharacterIdStandingsGet: {
            /** Format: int64 */
            from_id: number;
            /** @enum {string} */
            from_type: "agent" | "npc_corp" | "faction";
            /** Format: double */
            standing: number;
        }[];
        CharactersCharacterIdTitlesGet: {
            name?: string;
            /** Format: int64 */
            title_id?: number;
        }[];
        /**
         * Format: double
         * @description Wallet balance
         */
        CharactersCharacterIdWalletGet: number;
        /** @description Wallet journal entries */
        CharactersCharacterIdWalletJournalGet: {
            /**
             * Format: double
             * @description The amount of ISK given or taken from the wallet as a result of the given transaction. Positive when ISK is deposited into the wallet and negative when ISK is withdrawn
             */
            amount?: number;
            /**
             * Format: double
             * @description Wallet balance after transaction occurred
             */
            balance?: number;
            /**
             * Format: int64
             * @description An ID that gives extra context to the particular transaction. Because of legacy reasons the context is completely different per ref_type and means different things. It is also possible to not have a context_id
             */
            context_id?: number;
            /**
             * @description The type of the given context_id if present
             * @enum {string}
             */
            context_id_type?: "structure_id" | "station_id" | "market_transaction_id" | "character_id" | "corporation_id" | "alliance_id" | "eve_system" | "industry_job_id" | "contract_id" | "planet_id" | "system_id" | "type_id";
            /**
             * Format: date-time
             * @description Date and time of transaction
             */
            date: string;
            /** @description The reason for the transaction, mirrors what is seen in the client */
            description: string;
            /**
             * Format: int64
             * @description The id of the first party involved in the transaction. This attribute has no consistency and is different or non existant for particular ref_types. The description attribute will help make sense of what this attribute means. For more info about the given ID it can be dropped into the /universe/names/ ESI route to determine its type and name
             */
            first_party_id?: number;
            /**
             * Format: int64
             * @description Unique journal reference ID
             */
            id: number;
            /** @description The user stated reason for the transaction. Only applies to some ref_types */
            reason?: string;
            /**
             * @description "The transaction type for the given. transaction. Different transaction types will populate different attributes."
             * @enum {string}
             */
            ref_type: "acceleration_gate_fee" | "achievement_category_milestone_reward" | "achievement_milestone_reward" | "advertisement_listing_fee" | "agent_donation" | "agent_location_services" | "agent_miscellaneous" | "agent_mission_collateral_paid" | "agent_mission_collateral_refunded" | "agent_mission_reward" | "agent_mission_reward_corporation_tax" | "agent_mission_security_tax" | "agent_mission_time_bonus_reward" | "agent_mission_time_bonus_reward_corporation_tax" | "agent_security_services" | "agent_services_rendered" | "agents_preward" | "air_career_program_reward" | "alliance_maintainance_fee" | "alliance_registration_fee" | "allignment_based_gate_toll" | "asset_safety_recovery_tax" | "bounty" | "bounty_prize" | "bounty_prize_corporation_tax" | "bounty_prizes" | "bounty_reimbursement" | "bounty_surcharge" | "brokers_fee" | "campaign_objective_isk_reward" | "clone_activation" | "clone_transfer" | "contraband_fine" | "contract_auction_bid" | "contract_auction_bid_corp" | "contract_auction_bid_refund" | "contract_auction_sold" | "contract_brokers_fee" | "contract_brokers_fee_corp" | "contract_collateral" | "contract_collateral_deposited_corp" | "contract_collateral_payout" | "contract_collateral_refund" | "contract_deposit" | "contract_deposit_corp" | "contract_deposit_refund" | "contract_deposit_sales_tax" | "contract_price" | "contract_price_payment_corp" | "contract_reversal" | "contract_reward" | "contract_reward_deposited" | "contract_reward_deposited_corp" | "contract_reward_refund" | "contract_sales_tax" | "copying" | "corporate_reward_payout" | "corporate_reward_tax" | "corporation_account_withdrawal" | "corporation_bulk_payment" | "corporation_dividend_payment" | "corporation_liquidation" | "corporation_logo_change_cost" | "corporation_payment" | "corporation_registration_fee" | "cosmetic_market_component_item_purchase" | "cosmetic_market_skin_purchase" | "cosmetic_market_skin_sale" | "cosmetic_market_skin_sale_broker_fee" | "cosmetic_market_skin_sale_tax" | "cosmetic_market_skin_transaction" | "courier_mission_escrow" | "cspa" | "cspaofflinerefund" | "daily_challenge_reward" | "daily_goal_payouts" | "daily_goal_payouts_tax" | "datacore_fee" | "dna_modification_fee" | "docking_fee" | "duel_wager_escrow" | "duel_wager_payment" | "duel_wager_refund" | "ess_escrow_transfer" | "external_trade_delivery" | "external_trade_freeze" | "external_trade_thaw" | "factory_slot_rental_fee" | "flux_payout" | "flux_tax" | "flux_ticket_repayment" | "flux_ticket_sale" | "freelance_jobs_broadcasting_fee" | "freelance_jobs_duration_fee" | "freelance_jobs_escrow_refund" | "freelance_jobs_reward" | "freelance_jobs_reward_corporation_tax" | "freelance_jobs_reward_escrow" | "gm_cash_transfer" | "gm_plex_fee_refund" | "industry_job_tax" | "industry_security_tax" | "infrastructure_hub_maintenance" | "inheritance" | "insurance" | "insurgency_corruption_contribution_reward" | "insurgency_suppression_contribution_reward" | "item_trader_payment" | "jump_clone_activation_fee" | "jump_clone_installation_fee" | "kill_right_fee" | "lp_store" | "manufacturing" | "market_escrow" | "market_fine_paid" | "market_provider_tax" | "market_security_tax" | "market_transaction" | "medal_creation" | "medal_issued" | "milestone_reward_payment" | "mission_completion" | "mission_cost" | "mission_expiration" | "mission_reward" | "npc_bounty_security_tax" | "office_rental_fee" | "operation_bonus" | "opportunity_reward" | "planetary_construction" | "planetary_export_tax" | "planetary_import_tax" | "player_donation" | "player_trading" | "project_discovery_reward" | "project_discovery_tax" | "project_payouts" | "reaction" | "redeemed_isk_token" | "release_of_impounded_property" | "repair_bill" | "reprocessing_tax" | "researching_material_productivity" | "researching_technology" | "researching_time_productivity" | "resource_wars_reward" | "reverse_engineering" | "season_challenge_reward" | "security_processing_fee" | "shares" | "skill_purchase" | "skyhook_claim_fee" | "sovereignity_bill" | "store_purchase" | "store_purchase_refund" | "structure_gate_jump" | "transaction_tax" | "under_construction" | "upkeep_adjustment_fee" | "war_ally_contract" | "war_fee" | "war_fee_surrender";
            /**
             * Format: int64
             * @description The id of the second party involved in the transaction. This attribute has no consistency and is different or non existant for particular ref_types. The description attribute will help make sense of what this attribute means. For more info about the given ID it can be dropped into the /universe/names/ ESI route to determine its type and name
             */
            second_party_id?: number;
            /**
             * Format: double
             * @description Tax amount received. Only applies to tax related transactions
             */
            tax?: number;
            /**
             * Format: int64
             * @description The corporation ID receiving any tax paid. Only applies to tax related transactions
             */
            tax_receiver_id?: number;
        }[];
        /** @description Wallet transactions */
        CharactersCharacterIdWalletTransactionsGet: {
            /** Format: int64 */
            client_id: number;
            /**
             * Format: date-time
             * @description Date and time of transaction
             */
            date: string;
            is_buy: boolean;
            is_personal: boolean;
            /** Format: int64 */
            journal_ref_id: number;
            /** Format: int64 */
            location_id: number;
            /** Format: int64 */
            quantity: number;
            /**
             * Format: int64
             * @description Unique transaction ID
             */
            transaction_id: number;
            /** Format: int64 */
            type_id: number;
            /**
             * Format: double
             * @description Amount paid per unit
             */
            unit_price: number;
        }[];
        CharactersCosmeticsSkinr: {
            /** @description SKINR licenses the character owns */
            licenses: components["schemas"]["CharactersCosmeticsSkinrItem"][];
        };
        CharactersCosmeticsSkinrComponents: {
            /** @description SKINR component licenses the character owns */
            licenses: components["schemas"]["CharactersCosmeticsSkinrComponentsItem"][];
        };
        CharactersCosmeticsSkinrComponentsItem: {
            /**
             * Format: int64
             * @description ID of the component (see SDE for details)
             * @example 67890
             */
            component_id: number;
            /** @description Remaining uses of this license */
            runs: {
                /**
                 * Format: int64
                 * @description Runs remaining on license
                 */
                remaining?: number;
            } | {
                /** @description Whether the license has unlimited uses */
                unlimited?: boolean;
            };
            /**
             * @description Kind of component
             * @enum {string}
             */
            type: "nanocoating" | "pattern";
        };
        CharactersCosmeticsSkinrItem: {
            /** @description Whether this SKINR is activated */
            activated: boolean;
            /** @description SKINR identifier */
            skinr_id: string;
            /**
             * Format: int64
             * @description Number of unactivated copies of this SKINR
             * @example 3
             */
            unactivated: number;
        };
        CharactersDetail: {
            /**
             * Format: int64
             * @description Character's achievement score
             * @example 1234
             */
            achievement_score: number;
            /** @description Character's alliance ID */
            alliance_id?: components["schemas"]["AllianceID"];
            /**
             * Format: date-time
             * @description Character's creation date
             */
            birthday: string;
            /** @description Character's bloodline ID */
            bloodline_id: components["schemas"]["BloodlineID"];
            /** @description Character's equipped cosmetic title ID */
            character_title_id?: components["schemas"]["UUID"];
            /** @description Character's corporation ID */
            corporation_id: components["schemas"]["CorporationID"];
            /** @description Character's corporation title */
            corporation_title?: string;
            /** @description Character's description (biography) */
            description?: string;
            /** @description Character's faction ID */
            faction_id?: components["schemas"]["FactionID"];
            /**
             * @description Character's gender
             * @enum {string}
             */
            gender: "male" | "female";
            /** @description Character's name */
            name: string;
            /** @description Character's race ID */
            race_id: components["schemas"]["RaceID"];
            /**
             * Format: double
             * @description Character's security status
             * @example 5
             */
            security_status?: number;
        };
        CharactersFreelanceJobsListing: {
            /** @description List of freelance jobs */
            freelance_jobs: components["schemas"]["FreelanceJobsDetailFreelancejob"][];
        };
        CharactersFreelanceJobsParticipation: {
            /**
             * Format: int64
             * @description Your contribution
             * @example 100
             */
            contributed: number;
            /**
             * Format: date-time
             * @description Moment this information was last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
            /**
             * @description Your participation status
             * @example Committed
             * @enum {string}
             */
            state: "Unspecified" | "Committed" | "Kicked" | "Resigned";
        };
        CharactersLocation: {
            /** @description Solar system the character is in */
            solar_system_id: components["schemas"]["SolarSystemID"];
            /** @description Station the character is docked in */
            station_id?: components["schemas"]["StationID"];
            /** @description Structure the character is docked in */
            structure_id?: components["schemas"]["ItemID"];
        };
        CharactersMercenaryTacticalOperationsDetail: {
            /** @description Operation's dungeon type ID */
            dungeon_type_id: components["schemas"]["DungeonID"];
            /**
             * Format: date-time
             * @description Moment the operation will expire
             * @example 2026-02-23T12:00:00Z
             */
            expires: string;
            /** @description Operation's ID */
            id: components["schemas"]["UUID"];
            /** @description ID of Mercenary Den offering this operation */
            mercenary_den_id: components["schemas"]["ItemID"];
            /**
             * @description Operation's state
             * @enum {string}
             */
            state: "Unspecified" | "Available" | "Started" | "Completed" | "Expired" | "Removed";
        };
        CharactersMercenaryTacticalOperationsListing: {
            /** @description List of available operations */
            operations: components["schemas"]["CharactersMercenaryTacticalOperationsListingOperation"][];
        };
        CharactersMercenaryTacticalOperationsListingOperation: {
            /** @description Operation's ID */
            id: components["schemas"]["UUID"];
            /** @description ID of Mercenary Den offering this operation */
            mercenary_den_id: components["schemas"]["ItemID"];
        };
        CharactersMilitaryCampaignsObjectivesListing: {
            cursor?: components["schemas"]["Cursor"];
            /** @description List of military campaign objectives */
            objectives: components["schemas"]["CharactersMilitaryCampaignsObjectivesParticipationCharacterobjective"][];
        };
        CharactersMilitaryCampaignsObjectivesParticipation: {
            /** @description Campaign's ID */
            campaign_id: components["schemas"]["UUID"];
            /**
             * Format: int64
             * @description The character's cumulative contribution
             * @example 10
             */
            contributed: number;
            /** @description Objective's ID */
            id: components["schemas"]["UUID"];
            /**
             * @description Whether the character is currently committed to the objective
             * @example true
             */
            is_committed: boolean;
            /**
             * Format: date-time
             * @description Moment this information was last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
        };
        CharactersMilitaryCampaignsObjectivesParticipationCharacterobjective: {
            /** @description Campaign's ID */
            campaign_id: components["schemas"]["UUID"];
            /**
             * Format: int64
             * @description The character's cumulative contribution
             * @example 10
             */
            contributed: number;
            /** @description Objective's ID */
            id: components["schemas"]["UUID"];
            /**
             * @description Whether the character is currently committed to the objective
             * @example true
             */
            is_committed: boolean;
            /**
             * Format: date-time
             * @description Moment this information was last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
        };
        CharactersOnline: {
            /**
             * Format: date-time
             * @description When the character last logged in
             * @example 2017-01-02T03:04:05Z
             */
            last_login?: string;
            /**
             * Format: date-time
             * @description When the character last logged out
             * @example 2017-01-02T04:05:06Z
             */
            last_logout?: string;
            /**
             * Format: int64
             * @description Total logins (all-time)
             * @example 9001
             */
            logins?: number;
            /** @description Whether the character is online */
            online: boolean;
        };
        CharactersParagonHubSkinr: {
            cursor?: components["schemas"]["Cursor"];
            /** @description Page of SKINR listings the character has posted */
            listings: components["schemas"]["CharactersParagonHubSkinrItem"][];
        };
        CharactersParagonHubSkinrItem: {
            /**
             * Format: date-time
             * @description When the listing was created
             */
            created: string;
            /**
             * Format: date-time
             * @description When the listing expires
             */
            expires: string;
            /** @description Unique identifier of the listing */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description When this listing was last retrieved from the game
             */
            last_modified: string;
            /** @description Asking price of the listing */
            price: {
                /**
                 * Format: double
                 * @description Price in ISK
                 */
                isk?: number;
            } | {
                /**
                 * Format: int64
                 * @description Price in PLEX
                 */
                plex?: number;
            };
            /**
             * Format: int64
             * @description How many licenses remain in this listing
             * @example 3
             */
            quantity: number;
            /** @description Character that posted the listing */
            seller_id: components["schemas"]["CharacterID"];
            /** @description SKINR license identifier */
            skinr_id: string;
            /**
             * @description Lifecycle state of the listing
             * @enum {string}
             */
            state: "listed" | "sold_out" | "expired" | "removed";
            /** @description Who the listing is visible to */
            target: {
                /** @description Character the listing is visible to */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation the listing is visible to */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance the listing is visible to */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Whether the listing is visible to everyone */
                public?: boolean;
            };
        };
        CharactersShip: {
            /** @description Unique identifier for this ship */
            ship_item_id: components["schemas"]["ItemID"];
            /** @description Name of this ship */
            ship_name: string;
            /** @description Type of the ship currently piloted */
            ship_type_id: components["schemas"]["TypeID"];
        };
        CharactersSkillqueueSkill: {
            /**
             * Format: date-time
             * @description The date the skill training will finish
             */
            finish_date?: string;
            /**
             * Format: int64
             * @description The level the skill is training for
             */
            finished_level: number;
            /**
             * Format: int64
             * @description The Skill Points at the end of the level
             */
            level_end_sp?: number;
            /**
             * Format: int64
             * @description The Skill Points at the start of the level
             */
            level_start_sp?: number;
            /**
             * Format: int64
             * @description The position of the skill in the queue
             */
            queue_position: number;
            /** @description The TypeID of the skill */
            skill_id: components["schemas"]["TypeID"];
            /**
             * Format: date-time
             * @description The date the skill training will start/continue
             */
            start_date?: string;
            /**
             * Format: int64
             * @description The Skill Points at the start of training
             */
            training_start_sp?: number;
        };
        CharactersSkills: {
            /** @description The trained skills */
            skills: components["schemas"]["CharactersSkillsSkill"][];
            /**
             * Format: int64
             * @description The total Skill Points spent on skills
             */
            total_sp: number;
            /**
             * Format: int64
             * @description The amount of unallocated Skill Points
             */
            unallocated_sp?: number;
        };
        CharactersSkillsSkill: {
            /**
             * Format: int64
             * @description The active skill level (can differ from trained due to alpha status and/or active expert systems)
             */
            active_skill_level: number;
            /**
             * Format: int64
             * @description The Type ID of the skill
             */
            skill_id: number;
            /**
             * Format: int64
             * @description The amount of Skill Points in the skill
             */
            skillpoints_in_skill: number;
            /**
             * Format: int64
             * @description The trained skill level
             */
            trained_skill_level: number;
        };
        CharactersStructuresMercenaryDensDetail: {
            /** @description Mercenary Den's evolution */
            evolution: components["schemas"]["CharactersStructuresMercenaryDensDetailEvolution"];
            /** @description Mercenary Den's ID */
            id: components["schemas"]["ItemID"];
            /** @description Mercenary Den's infomorphs */
            infomorphs: components["schemas"]["CharactersStructuresMercenaryDensDetailInfomorphs"];
            /** @description Mercenary Den's reinforcement timer (if the structure is reinforced) */
            reinforcement_timer?: components["schemas"]["CharactersStructuresMercenaryDensDetailReinforcementtimer"];
            /** @description Skyhook the Mercenary Den is attached to */
            skyhook: components["schemas"]["CharactersStructuresMercenaryDensDetailSkyhook"];
            /**
             * @description Mercenary Den's state
             * @enum {string}
             */
            state: "Unspecified" | "Running" | "Paused" | "Disabled";
            /** @description Mercenary Den's type ID */
            type_id: components["schemas"]["TypeID"];
        };
        CharactersStructuresMercenaryDensDetailEvolution: {
            /** @description Mercenary Den's anarchy */
            anarchy: components["schemas"]["CharactersStructuresMercenaryDensDetailEvolutionanarchy"];
            /** @description Mercenary Den's development */
            development: components["schemas"]["CharactersStructuresMercenaryDensDetailEvolutiondevelopment"];
        };
        CharactersStructuresMercenaryDensDetailEvolutionanarchy: {
            /**
             * Format: int64
             * @description Anarchy's cumulative amount (0-100)
             * @example 0
             */
            amount: number;
            /**
             * @description Anarchy's level
             * @enum {string}
             */
            level: "Unspecified" | "Level0" | "Level1" | "Level2" | "Level3" | "Level4";
        };
        CharactersStructuresMercenaryDensDetailEvolutiondevelopment: {
            /**
             * Format: int64
             * @description Development's cumulative amount (0-100)
             * @example 50
             */
            amount: number;
            /**
             * @description Development's level
             * @enum {string}
             */
            level: "Unspecified" | "Level0" | "Level1" | "Level2" | "Level3" | "Level4";
        };
        CharactersStructuresMercenaryDensDetailInfomorphs: {
            /**
             * Format: int64
             * @description Amount of infomorphs
             * @example 100
             */
            amount: number;
        };
        CharactersStructuresMercenaryDensDetailReinforcementtimer: {
            /**
             * Format: date-time
             * @description The time when the reinforcement timer will end
             */
            end: string;
        };
        CharactersStructuresMercenaryDensDetailSkyhook: {
            /** @description Corporation that owns the Skyhook */
            corporation_id: components["schemas"]["CorporationID"];
            /** @description Skyhook's ID */
            id: components["schemas"]["ItemID"];
            /** @description ID of the planet the Skyhook is anchored on */
            planet_id: components["schemas"]["PlanetID"];
        };
        CharactersStructuresMercenaryDensListing: {
            /** @description List of Mercenary Dens */
            mercenary_dens: components["schemas"]["CharactersStructuresMercenaryDensListingMercenaryden"][];
        };
        CharactersStructuresMercenaryDensListingMercenaryden: {
            /** @description Mercenary Den's ID */
            id: components["schemas"]["ItemID"];
            /** @description ID of the planet the Skyhook (to which the Mercenary Den is attached) is anchored on */
            planet_id: components["schemas"]["PlanetID"];
        };
        /**
         * Format: date
         * @example 2025-08-26
         */
        CompatibilityDate: string;
        /**
         * Format: int64
         * @example 20000001
         */
        ConstellationID: number;
        ContractsPublicBidsContractIdGet: {
            /**
             * Format: double
             * @description The amount bid, in ISK
             */
            amount: number;
            /**
             * Format: int64
             * @description Unique ID for the bid
             */
            bid_id: number;
            /**
             * Format: date-time
             * @description Datetime when the bid was placed
             */
            date_bid: string;
        }[];
        ContractsPublicItemsContractIdGet: {
            is_blueprint_copy?: boolean;
            /** @description true if the contract issuer has submitted this item with the contract, false if the isser is asking for this item in the contract */
            is_included: boolean;
            /**
             * Format: int64
             * @description Unique ID for the item being sold. Not present if item is being requested by contract rather than sold with contract
             */
            item_id?: number;
            /**
             * Format: int64
             * @description Material Efficiency Level of the blueprint
             */
            material_efficiency?: number;
            /**
             * Format: int64
             * @description Number of items in the stack
             */
            quantity: number;
            /**
             * Format: int64
             * @description Unique ID for the item, used by the contract system
             */
            record_id: number;
            /**
             * Format: int64
             * @description Number of runs remaining if the blueprint is a copy, -1 if it is an original
             */
            runs?: number;
            /**
             * Format: int64
             * @description Time Efficiency Level of the blueprint
             */
            time_efficiency?: number;
            /**
             * Format: int64
             * @description Type ID for item
             */
            type_id: number;
        }[];
        ContractsPublicRegionIdGet: {
            /**
             * Format: double
             * @description Buyout price (for Auctions only)
             */
            buyout?: number;
            /**
             * Format: double
             * @description Collateral price (for Couriers only)
             */
            collateral?: number;
            /** Format: int64 */
            contract_id: number;
            /**
             * Format: date-time
             * @description Expiration date of the contract
             */
            date_expired: string;
            /**
             * Format: date-time
             * @description Сreation date of the contract
             */
            date_issued: string;
            /**
             * Format: int64
             * @description Number of days to perform the contract
             */
            days_to_complete?: number;
            /**
             * Format: int64
             * @description End location ID (for Couriers contract)
             */
            end_location_id?: number;
            /** @description true if the contract was issued on behalf of the issuer's corporation */
            for_corporation?: boolean;
            /**
             * Format: int64
             * @description Character's corporation ID for the issuer
             */
            issuer_corporation_id: number;
            /**
             * Format: int64
             * @description Character ID for the issuer
             */
            issuer_id: number;
            /**
             * Format: double
             * @description Price of contract (for ItemsExchange and Auctions)
             */
            price?: number;
            /**
             * Format: double
             * @description Remuneration for contract (for Couriers only)
             */
            reward?: number;
            /**
             * Format: int64
             * @description Start location ID (for Couriers contract)
             */
            start_location_id?: number;
            /** @description Title of the contract */
            title?: string;
            /**
             * @description Type of the contract
             * @enum {string}
             */
            type: "unknown" | "item_exchange" | "auction" | "courier" | "loan";
            /**
             * Format: double
             * @description Volume of items in the contract
             */
            volume?: number;
        }[];
        CorporationCorporationIdMiningExtractionsGet: {
            /**
             * Format: date-time
             * @description The time at which the chunk being extracted will arrive and can be fractured by the moon mining drill.
             */
            chunk_arrival_time: string;
            /**
             * Format: date-time
             * @description The time at which the current extraction was initiated.
             */
            extraction_start_time: string;
            /** Format: int64 */
            moon_id: number;
            /**
             * Format: date-time
             * @description The time at which the chunk being extracted will naturally fracture if it is not first fractured by the moon mining drill.
             */
            natural_decay_time: string;
            /** Format: int64 */
            structure_id: number;
        }[];
        CorporationCorporationIdMiningObserversGet: {
            /** Format: date */
            last_updated: string;
            /**
             * Format: int64
             * @description The entity that was observing the asteroid field when it was mined.
             */
            observer_id: number;
            /**
             * @description The category of the observing entity
             * @enum {string}
             */
            observer_type: "structure";
        }[];
        CorporationCorporationIdMiningObserversObserverIdGet: {
            /**
             * Format: int64
             * @description The character that did the mining
             */
            character_id: number;
            /** Format: date */
            last_updated: string;
            /** Format: int64 */
            quantity: number;
            /**
             * Format: int64
             * @description The corporation id of the character at the time data was recorded.
             */
            recorded_corporation_id: number;
            /** Format: int64 */
            type_id: number;
        }[];
        /**
         * Format: int64
         * @example 98777771
         */
        CorporationID: number;
        CorporationsCorporationIdAlliancehistoryGet: {
            /** Format: int64 */
            alliance_id?: number;
            /** @description True if the alliance has been closed */
            is_deleted?: boolean;
            /**
             * Format: int64
             * @description An incrementing ID that can be used to canonically establish order of records in cases where dates may be ambiguous
             */
            record_id: number;
            /** Format: date-time */
            start_date: string;
        }[];
        CorporationsCorporationIdAssetsGet: {
            is_blueprint_copy?: boolean;
            is_singleton: boolean;
            /** Format: int64 */
            item_id: number;
            /** @enum {string} */
            location_flag: "AssetSafety" | "AutoFit" | "Bonus" | "Booster" | "BoosterBay" | "Capsule" | "CapsuleerDeliveries" | "Cargo" | "CorpDeliveries" | "CorpSAG1" | "CorpSAG2" | "CorpSAG3" | "CorpSAG4" | "CorpSAG5" | "CorpSAG6" | "CorpSAG7" | "CorporationGoalDeliveries" | "CrateLoot" | "Deliveries" | "DroneBay" | "DustBattle" | "DustDatabank" | "ExpeditionHold" | "FighterBay" | "FighterTube0" | "FighterTube1" | "FighterTube2" | "FighterTube3" | "FighterTube4" | "FleetHangar" | "FrigateEscapeBay" | "Hangar" | "HangarAll" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "HiddenModifiers" | "Implant" | "Impounded" | "InfrastructureHangar" | "JunkyardReprocessed" | "JunkyardTrashed" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "Locked" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "MobileDepotHold" | "MoonMaterialBay" | "OfficeFolder" | "Pilot" | "PlanetSurface" | "QuafeBay" | "QuantumCoreRoom" | "Reward" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "RigSlot3" | "RigSlot4" | "RigSlot5" | "RigSlot6" | "RigSlot7" | "SecondaryStorage" | "ServiceSlot0" | "ServiceSlot1" | "ServiceSlot2" | "ServiceSlot3" | "ServiceSlot4" | "ServiceSlot5" | "ServiceSlot6" | "ServiceSlot7" | "ShipHangar" | "ShipOffline" | "Skill" | "SkillInTraining" | "SpecializedAmmoHold" | "SpecializedAsteroidHold" | "SpecializedCommandCenterHold" | "SpecializedFuelBay" | "SpecializedGasHold" | "SpecializedIceHold" | "SpecializedIndustrialShipHold" | "SpecializedLargeShipHold" | "SpecializedMaterialBay" | "SpecializedMediumShipHold" | "SpecializedMineralHold" | "SpecializedOreHold" | "SpecializedPlanetaryCommoditiesHold" | "SpecializedSalvageHold" | "SpecializedShipHold" | "SpecializedSmallShipHold" | "StructureActive" | "StructureFuel" | "StructureInactive" | "StructureOffline" | "SubSystemBay" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3" | "SubSystemSlot4" | "SubSystemSlot5" | "SubSystemSlot6" | "SubSystemSlot7" | "Unlocked" | "Wallet" | "Wardrobe";
            /** Format: int64 */
            location_id: number;
            /** @enum {string} */
            location_type: "station" | "solar_system" | "item" | "other";
            /** Format: int64 */
            quantity: number;
            /** Format: int64 */
            type_id: number;
        }[];
        CorporationsCorporationIdAssetsLocationsPost: {
            /** Format: int64 */
            item_id: number;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
        }[];
        CorporationsCorporationIdAssetsNamesPost: {
            /** Format: int64 */
            item_id: number;
            name: string;
        }[];
        CorporationsCorporationIdBlueprintsGet: {
            /**
             * Format: int64
             * @description Unique ID for this item.
             */
            item_id: number;
            /**
             * @description Type of the location_id
             * @enum {string}
             */
            location_flag: "AssetSafety" | "AutoFit" | "Bonus" | "Booster" | "BoosterBay" | "Capsule" | "CapsuleerDeliveries" | "Cargo" | "CorpDeliveries" | "CorpSAG1" | "CorpSAG2" | "CorpSAG3" | "CorpSAG4" | "CorpSAG5" | "CorpSAG6" | "CorpSAG7" | "CorporationGoalDeliveries" | "CrateLoot" | "Deliveries" | "DroneBay" | "DustBattle" | "DustDatabank" | "ExpeditionHold" | "FighterBay" | "FighterTube0" | "FighterTube1" | "FighterTube2" | "FighterTube3" | "FighterTube4" | "FleetHangar" | "FrigateEscapeBay" | "Hangar" | "HangarAll" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "HiddenModifiers" | "Implant" | "Impounded" | "InfrastructureHangar" | "JunkyardReprocessed" | "JunkyardTrashed" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "Locked" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "MobileDepotHold" | "MoonMaterialBay" | "OfficeFolder" | "Pilot" | "PlanetSurface" | "QuafeBay" | "QuantumCoreRoom" | "Reward" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "RigSlot3" | "RigSlot4" | "RigSlot5" | "RigSlot6" | "RigSlot7" | "SecondaryStorage" | "ServiceSlot0" | "ServiceSlot1" | "ServiceSlot2" | "ServiceSlot3" | "ServiceSlot4" | "ServiceSlot5" | "ServiceSlot6" | "ServiceSlot7" | "ShipHangar" | "ShipOffline" | "Skill" | "SkillInTraining" | "SpecializedAmmoHold" | "SpecializedAsteroidHold" | "SpecializedCommandCenterHold" | "SpecializedFuelBay" | "SpecializedGasHold" | "SpecializedIceHold" | "SpecializedIndustrialShipHold" | "SpecializedLargeShipHold" | "SpecializedMaterialBay" | "SpecializedMediumShipHold" | "SpecializedMineralHold" | "SpecializedOreHold" | "SpecializedPlanetaryCommoditiesHold" | "SpecializedSalvageHold" | "SpecializedShipHold" | "SpecializedSmallShipHold" | "StructureActive" | "StructureFuel" | "StructureInactive" | "StructureOffline" | "SubSystemBay" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3" | "SubSystemSlot4" | "SubSystemSlot5" | "SubSystemSlot6" | "SubSystemSlot7" | "Unlocked" | "Wallet" | "Wardrobe";
            /**
             * Format: int64
             * @description References a station, a ship or an item_id if this blueprint is located within a container.
             */
            location_id: number;
            /**
             * Format: int64
             * @description Material Efficiency Level of the blueprint.
             */
            material_efficiency: number;
            /**
             * Format: int64
             * @description A range of numbers with a minimum of -2 and no maximum value where -1 is an original and -2 is a copy. It can be a positive integer if it is a stack of blueprint originals fresh from the market (e.g. no activities performed on them yet).
             */
            quantity: number;
            /**
             * Format: int64
             * @description Number of runs remaining if the blueprint is a copy, -1 if it is an original.
             */
            runs: number;
            /**
             * Format: int64
             * @description Time Efficiency Level of the blueprint.
             */
            time_efficiency: number;
            /** Format: int64 */
            type_id: number;
        }[];
        CorporationsCorporationIdContactsGet: {
            /** Format: int64 */
            contact_id: number;
            /** @enum {string} */
            contact_type: "character" | "corporation" | "alliance" | "faction";
            /** @description Whether this contact is being watched */
            is_watched?: boolean;
            label_ids?: number[];
            /**
             * Format: double
             * @description Standing of the contact
             */
            standing: number;
        }[];
        CorporationsCorporationIdContactsLabelsGet: {
            /** Format: int64 */
            label_id: number;
            label_name: string;
        }[];
        CorporationsCorporationIdContainersLogsGet: {
            /** @enum {string} */
            action: "add" | "assemble" | "configure" | "enter_password" | "lock" | "move" | "repackage" | "set_name" | "set_password" | "unlock";
            /**
             * Format: int64
             * @description ID of the character who performed the action.
             */
            character_id: number;
            /**
             * Format: int64
             * @description ID of the container
             */
            container_id: number;
            /**
             * Format: int64
             * @description Type ID of the container
             */
            container_type_id: number;
            /** @enum {string} */
            location_flag: "AssetSafety" | "AutoFit" | "Bonus" | "Booster" | "BoosterBay" | "Capsule" | "CapsuleerDeliveries" | "Cargo" | "CorpDeliveries" | "CorpSAG1" | "CorpSAG2" | "CorpSAG3" | "CorpSAG4" | "CorpSAG5" | "CorpSAG6" | "CorpSAG7" | "CorporationGoalDeliveries" | "CrateLoot" | "Deliveries" | "DroneBay" | "DustBattle" | "DustDatabank" | "ExpeditionHold" | "FighterBay" | "FighterTube0" | "FighterTube1" | "FighterTube2" | "FighterTube3" | "FighterTube4" | "FleetHangar" | "FrigateEscapeBay" | "Hangar" | "HangarAll" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "HiddenModifiers" | "Implant" | "Impounded" | "InfrastructureHangar" | "JunkyardReprocessed" | "JunkyardTrashed" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "Locked" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "MobileDepotHold" | "MoonMaterialBay" | "OfficeFolder" | "Pilot" | "PlanetSurface" | "QuafeBay" | "QuantumCoreRoom" | "Reward" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "RigSlot3" | "RigSlot4" | "RigSlot5" | "RigSlot6" | "RigSlot7" | "SecondaryStorage" | "ServiceSlot0" | "ServiceSlot1" | "ServiceSlot2" | "ServiceSlot3" | "ServiceSlot4" | "ServiceSlot5" | "ServiceSlot6" | "ServiceSlot7" | "ShipHangar" | "ShipOffline" | "Skill" | "SkillInTraining" | "SpecializedAmmoHold" | "SpecializedAsteroidHold" | "SpecializedCommandCenterHold" | "SpecializedFuelBay" | "SpecializedGasHold" | "SpecializedIceHold" | "SpecializedIndustrialShipHold" | "SpecializedLargeShipHold" | "SpecializedMaterialBay" | "SpecializedMediumShipHold" | "SpecializedMineralHold" | "SpecializedOreHold" | "SpecializedPlanetaryCommoditiesHold" | "SpecializedSalvageHold" | "SpecializedShipHold" | "SpecializedSmallShipHold" | "StructureActive" | "StructureFuel" | "StructureInactive" | "StructureOffline" | "SubSystemBay" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3" | "SubSystemSlot4" | "SubSystemSlot5" | "SubSystemSlot6" | "SubSystemSlot7" | "Unlocked" | "Wallet" | "Wardrobe";
            /** Format: int64 */
            location_id: number;
            /**
             * Format: date-time
             * @description Timestamp when this log was created
             */
            logged_at: string;
            /** Format: int64 */
            new_config_bitmask?: number;
            /** Format: int64 */
            old_config_bitmask?: number;
            /**
             * @description Type of password set if action is of type SetPassword or EnterPassword
             * @enum {string}
             */
            password_type?: "config" | "general";
            /**
             * Format: int64
             * @description Quantity of the item being acted upon
             */
            quantity?: number;
            /**
             * Format: int64
             * @description Type ID of the item being acted upon
             */
            type_id?: number;
        }[];
        CorporationsCorporationIdContractsContractIdBidsGet: {
            /**
             * Format: double
             * @description The amount bid, in ISK
             */
            amount: number;
            /**
             * Format: int64
             * @description Unique ID for the bid
             */
            bid_id: number;
            /**
             * Format: int64
             * @description Character ID of the bidder
             */
            bidder_id: number;
            /**
             * Format: date-time
             * @description Datetime when the bid was placed
             */
            date_bid: string;
        }[];
        CorporationsCorporationIdContractsContractIdItemsGet: {
            /** @description true if the contract issuer has submitted this item with the contract, false if the isser is asking for this item in the contract */
            is_included: boolean;
            is_singleton: boolean;
            /**
             * Format: int64
             * @description Number of items in the stack
             */
            quantity: number;
            /**
             * Format: int64
             * @description -1 indicates that the item is a singleton (non-stackable). If the item happens to be a Blueprint, -1 is an Original and -2 is a Blueprint Copy
             */
            raw_quantity?: number;
            /**
             * Format: int64
             * @description Unique ID for the item
             */
            record_id: number;
            /**
             * Format: int64
             * @description Type ID for item
             */
            type_id: number;
        }[];
        CorporationsCorporationIdContractsGet: {
            /**
             * Format: int64
             * @description Who will accept the contract
             */
            acceptor_id: number;
            /**
             * Format: int64
             * @description ID to whom the contract is assigned, can be corporation or character ID
             */
            assignee_id: number;
            /**
             * @description To whom the contract is available
             * @enum {string}
             */
            availability: "public" | "personal" | "corporation" | "alliance";
            /**
             * Format: double
             * @description Buyout price (for Auctions only)
             */
            buyout?: number;
            /**
             * Format: double
             * @description Collateral price (for Couriers only)
             */
            collateral?: number;
            /** Format: int64 */
            contract_id: number;
            /**
             * Format: date-time
             * @description Date of confirmation of contract
             */
            date_accepted?: string;
            /**
             * Format: date-time
             * @description Date of completed of contract
             */
            date_completed?: string;
            /**
             * Format: date-time
             * @description Expiration date of the contract
             */
            date_expired: string;
            /**
             * Format: date-time
             * @description Сreation date of the contract
             */
            date_issued: string;
            /**
             * Format: int64
             * @description Number of days to perform the contract
             */
            days_to_complete?: number;
            /**
             * Format: int64
             * @description End location ID (for Couriers contract)
             */
            end_location_id?: number;
            /** @description true if the contract was issued on behalf of the issuer's corporation */
            for_corporation: boolean;
            /**
             * Format: int64
             * @description Character's corporation ID for the issuer
             */
            issuer_corporation_id: number;
            /**
             * Format: int64
             * @description Character ID for the issuer
             */
            issuer_id: number;
            /**
             * Format: double
             * @description Price of contract (for ItemsExchange and Auctions)
             */
            price?: number;
            /**
             * Format: double
             * @description Remuneration for contract (for Couriers only)
             */
            reward?: number;
            /**
             * Format: int64
             * @description Start location ID (for Couriers contract)
             */
            start_location_id?: number;
            /**
             * @description Status of the the contract
             * @enum {string}
             */
            status: "outstanding" | "in_progress" | "finished_issuer" | "finished_contractor" | "finished" | "cancelled" | "rejected" | "failed" | "deleted" | "reversed";
            /** @description Title of the contract */
            title?: string;
            /**
             * @description Type of the contract
             * @enum {string}
             */
            type: "unknown" | "item_exchange" | "auction" | "courier" | "loan";
            /**
             * Format: double
             * @description Volume of items in the contract
             */
            volume?: number;
        }[];
        CorporationsCorporationIdCustomsOfficesGet: {
            /**
             * Format: double
             * @description Only present if alliance access is allowed
             */
            alliance_tax_rate?: number;
            /** @description standing_level and any standing related tax rate only present when this is true */
            allow_access_with_standings: boolean;
            allow_alliance_access: boolean;
            /** Format: double */
            bad_standing_tax_rate?: number;
            /** Format: double */
            corporation_tax_rate?: number;
            /**
             * Format: double
             * @description Tax rate for entities with excellent level of standing, only present if this level is allowed, same for all other standing related tax rates
             */
            excellent_standing_tax_rate?: number;
            /** Format: double */
            good_standing_tax_rate?: number;
            /** Format: double */
            neutral_standing_tax_rate?: number;
            /**
             * Format: int64
             * @description unique ID of this customs office
             */
            office_id: number;
            /** Format: int64 */
            reinforce_exit_end: number;
            /**
             * Format: int64
             * @description Together with reinforce_exit_end, marks a 2-hour or 6-hour (depending on the office type) period where this customs office could exit reinforcement mode during the day after initial attack
             */
            reinforce_exit_start: number;
            /**
             * @description Access is allowed only for entities with this level of standing or better
             * @enum {string}
             */
            standing_level?: "bad" | "excellent" | "good" | "neutral" | "terrible";
            /**
             * Format: int64
             * @description ID of the solar system this customs office is located in
             */
            system_id: number;
            /** Format: double */
            terrible_standing_tax_rate?: number;
            /**
             * Format: int64
             * @description ID of the type of this customs office
             */
            type_id?: number;
        }[];
        CorporationsCorporationIdDivisionsGet: {
            hangar?: {
                /** Format: int64 */
                division?: number;
                name?: string;
            }[];
            wallet?: {
                /** Format: int64 */
                division?: number;
                name?: string;
            }[];
        };
        CorporationsCorporationIdFacilitiesGet: {
            /** Format: int64 */
            facility_id: number;
            /** Format: int64 */
            system_id: number;
            /** Format: int64 */
            type_id: number;
        }[];
        CorporationsCorporationIdFwStatsGet: {
            /**
             * Format: date-time
             * @description The enlistment date of the given corporation into faction warfare. Will not be included if corporation is not enlisted in faction warfare
             */
            enlisted_on?: string;
            /**
             * Format: int64
             * @description The faction the given corporation is enlisted to fight for. Will not be included if corporation is not enlisted in faction warfare
             */
            faction_id?: number;
            /** @description Summary of kills done by the given corporation against enemy factions */
            kills: {
                /**
                 * Format: int64
                 * @description Last week's total number of kills by members of the given corporation against enemy factions
                 */
                last_week: number;
                /**
                 * Format: int64
                 * @description Total number of kills by members of the given corporation against enemy factions since the corporation enlisted
                 */
                total: number;
                /**
                 * Format: int64
                 * @description Yesterday's total number of kills by members of the given corporation against enemy factions
                 */
                yesterday: number;
            };
            /**
             * Format: int64
             * @description How many pilots the enlisted corporation has. Will not be included if corporation is not enlisted in faction warfare
             */
            pilots?: number;
            /** @description Summary of victory points gained by the given corporation for the enlisted faction */
            victory_points: {
                /**
                 * Format: int64
                 * @description Last week's victory points gained by members of the given corporation
                 */
                last_week: number;
                /**
                 * Format: int64
                 * @description Total victory points gained since the given corporation enlisted
                 */
                total: number;
                /**
                 * Format: int64
                 * @description Yesterday's victory points gained by members of the given corporation
                 */
                yesterday: number;
            };
        };
        CorporationsCorporationIdIconsGet: {
            px128x128?: string;
            px256x256?: string;
            px64x64?: string;
        };
        CorporationsCorporationIdIndustryJobsGet: {
            /**
             * Format: int64
             * @description Job activity ID
             */
            activity_id: number;
            /** Format: int64 */
            blueprint_id: number;
            /**
             * Format: int64
             * @description Location ID of the location from which the blueprint was installed. Normally a station ID, but can also be an asset (e.g. container) or corporation facility
             */
            blueprint_location_id: number;
            /** Format: int64 */
            blueprint_type_id: number;
            /**
             * Format: int64
             * @description ID of the character which completed this job
             */
            completed_character_id?: number;
            /**
             * Format: date-time
             * @description Date and time when this job was completed
             */
            completed_date?: string;
            /**
             * Format: double
             * @description The sume of job installation fee and industry facility tax
             */
            cost?: number;
            /**
             * Format: int64
             * @description Job duration in seconds
             */
            duration: number;
            /**
             * Format: date-time
             * @description Date and time when this job finished
             */
            end_date: string;
            /**
             * Format: int64
             * @description ID of the facility where this job is running
             */
            facility_id: number;
            /**
             * Format: int64
             * @description ID of the character which installed this job
             */
            installer_id: number;
            /**
             * Format: int64
             * @description Unique job ID
             */
            job_id: number;
            /**
             * Format: int64
             * @description Number of runs blueprint is licensed for
             */
            licensed_runs?: number;
            /**
             * Format: int64
             * @description ID of the location for the industry facility
             */
            location_id: number;
            /**
             * Format: int64
             * @description Location ID of the location to which the output of the job will be delivered. Normally a station ID, but can also be a corporation facility
             */
            output_location_id: number;
            /**
             * Format: date-time
             * @description Date and time when this job was paused (i.e. time when the facility where this job was installed went offline)
             */
            pause_date?: string;
            /**
             * Format: double
             * @description Chance of success for invention
             */
            probability?: number;
            /**
             * Format: int64
             * @description Type ID of product (manufactured, copied or invented)
             */
            product_type_id?: number;
            /**
             * Format: int64
             * @description Number of runs for a manufacturing job, or number of copies to make for a blueprint copy
             */
            runs: number;
            /**
             * Format: date-time
             * @description Date and time when this job started
             */
            start_date: string;
            /** @enum {string} */
            status: "active" | "cancelled" | "delivered" | "paused" | "ready" | "reverted";
            /**
             * Format: int64
             * @description Number of successful runs for this job. Equal to runs unless this is an invention job
             */
            successful_runs?: number;
        }[];
        CorporationsCorporationIdKillmailsRecentGet: {
            /** @description A hash of this killmail */
            killmail_hash: string;
            /**
             * Format: int64
             * @description ID of this killmail
             */
            killmail_id: number;
        }[];
        CorporationsCorporationIdMedalsGet: {
            /** Format: date-time */
            created_at: string;
            /**
             * Format: int64
             * @description ID of the character who created this medal
             */
            creator_id: number;
            description: string;
            /** Format: int64 */
            medal_id: number;
            title: string;
        }[];
        CorporationsCorporationIdMedalsIssuedGet: {
            /**
             * Format: int64
             * @description ID of the character who was rewarded this medal
             */
            character_id: number;
            /** Format: date-time */
            issued_at: string;
            /**
             * Format: int64
             * @description ID of the character who issued the medal
             */
            issuer_id: number;
            /** Format: int64 */
            medal_id: number;
            reason: string;
            /** @enum {string} */
            status: "private" | "public";
        }[];
        /** @description A list of character IDs */
        CorporationsCorporationIdMembersGet: number[];
        /** Format: int64 */
        CorporationsCorporationIdMembersLimitGet: number;
        CorporationsCorporationIdMembersTitlesGet: {
            /** Format: int64 */
            character_id: number;
            /** @description A list of title_id */
            titles: number[];
        }[];
        CorporationsCorporationIdMembertrackingGet: {
            /** Format: int64 */
            base_id?: number;
            /** Format: int64 */
            character_id: number;
            /** Format: int64 */
            location_id?: number;
            /** Format: date-time */
            logoff_date?: string;
            /** Format: date-time */
            logon_date?: string;
            /** Format: int64 */
            ship_type_id?: number;
            /** Format: date-time */
            start_date?: string;
        }[];
        CorporationsCorporationIdOrdersGet: {
            /**
             * Format: int64
             * @description Number of days for which order is valid (starting from the issued date). An order expires at time issued + duration
             */
            duration: number;
            /**
             * Format: double
             * @description For buy orders, the amount of ISK in escrow
             */
            escrow?: number;
            /** @description True if the order is a bid (buy) order */
            is_buy_order?: boolean;
            /**
             * Format: date-time
             * @description Date and time when this order was issued
             */
            issued: string;
            /**
             * Format: int64
             * @description The character who issued this order
             */
            issued_by: number;
            /**
             * Format: int64
             * @description ID of the location where order was placed
             */
            location_id: number;
            /**
             * Format: int64
             * @description For buy orders, the minimum quantity that will be accepted in a matching sell order
             */
            min_volume?: number;
            /**
             * Format: int64
             * @description Unique order ID
             */
            order_id: number;
            /**
             * Format: double
             * @description Cost per unit for this order
             */
            price: number;
            /**
             * @description Valid order range, numbers are ranges in jumps
             * @enum {string}
             */
            range: "1" | "10" | "2" | "20" | "3" | "30" | "4" | "40" | "5" | "region" | "solarsystem" | "station";
            /**
             * Format: int64
             * @description ID of the region where order was placed
             */
            region_id: number;
            /**
             * Format: int64
             * @description The type ID of the item transacted in this order
             */
            type_id: number;
            /**
             * Format: int64
             * @description Quantity of items still required or offered
             */
            volume_remain: number;
            /**
             * Format: int64
             * @description Quantity of items required or offered at time order was placed
             */
            volume_total: number;
            /**
             * Format: int64
             * @description The corporation wallet division used for this order.
             */
            wallet_division: number;
        }[];
        CorporationsCorporationIdOrdersHistoryGet: {
            /**
             * Format: int64
             * @description Number of days the order was valid for (starting from the issued date). An order expires at time issued + duration
             */
            duration: number;
            /**
             * Format: double
             * @description For buy orders, the amount of ISK in escrow
             */
            escrow?: number;
            /** @description True if the order is a bid (buy) order */
            is_buy_order?: boolean;
            /**
             * Format: date-time
             * @description Date and time when this order was issued
             */
            issued: string;
            /**
             * Format: int64
             * @description The character who issued this order
             */
            issued_by?: number;
            /**
             * Format: int64
             * @description ID of the location where order was placed
             */
            location_id: number;
            /**
             * Format: int64
             * @description For buy orders, the minimum quantity that will be accepted in a matching sell order
             */
            min_volume?: number;
            /**
             * Format: int64
             * @description Unique order ID
             */
            order_id: number;
            /**
             * Format: double
             * @description Cost per unit for this order
             */
            price: number;
            /**
             * @description Valid order range, numbers are ranges in jumps
             * @enum {string}
             */
            range: "1" | "10" | "2" | "20" | "3" | "30" | "4" | "40" | "5" | "region" | "solarsystem" | "station";
            /**
             * Format: int64
             * @description ID of the region where order was placed
             */
            region_id: number;
            /**
             * @description Current order state
             * @enum {string}
             */
            state: "cancelled" | "expired";
            /**
             * Format: int64
             * @description The type ID of the item transacted in this order
             */
            type_id: number;
            /**
             * Format: int64
             * @description Quantity of items still required or offered
             */
            volume_remain: number;
            /**
             * Format: int64
             * @description Quantity of items required or offered at time order was placed
             */
            volume_total: number;
            /**
             * Format: int64
             * @description The corporation wallet division used for this order
             */
            wallet_division: number;
        }[];
        CorporationsCorporationIdRolesGet: {
            /** Format: int64 */
            character_id: number;
            grantable_roles?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            grantable_roles_at_base?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            grantable_roles_at_hq?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            grantable_roles_at_other?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_base?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_hq?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_other?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
        }[];
        CorporationsCorporationIdRolesHistoryGet: {
            /** Format: date-time */
            changed_at: string;
            /**
             * Format: int64
             * @description The character whose roles are changed
             */
            character_id: number;
            /**
             * Format: int64
             * @description ID of the character who issued this change
             */
            issuer_id: number;
            new_roles: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            old_roles: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            /** @enum {string} */
            role_type: "grantable_roles" | "grantable_roles_at_base" | "grantable_roles_at_hq" | "grantable_roles_at_other" | "roles" | "roles_at_base" | "roles_at_hq" | "roles_at_other";
        }[];
        /** @description List of shareholders */
        CorporationsCorporationIdShareholdersGet: {
            /** Format: int64 */
            share_count: number;
            /** Format: int64 */
            shareholder_id: number;
            /** @enum {string} */
            shareholder_type: "character" | "corporation";
        }[];
        CorporationsCorporationIdStandingsGet: {
            /** Format: int64 */
            from_id: number;
            /** @enum {string} */
            from_type: "agent" | "npc_corp" | "faction";
            /** Format: double */
            standing: number;
        }[];
        CorporationsCorporationIdStarbasesGet: {
            /**
             * Format: int64
             * @description The moon this starbase (POS) is anchored on, unanchored POSes do not have this information
             */
            moon_id?: number;
            /**
             * Format: date-time
             * @description When the POS onlined, for starbases (POSes) in online state
             */
            onlined_since?: string;
            /**
             * Format: date-time
             * @description When the POS will be out of reinforcement, for starbases (POSes) in reinforced state
             */
            reinforced_until?: string;
            /**
             * Format: int64
             * @description Unique ID for this starbase (POS)
             */
            starbase_id: number;
            /** @enum {string} */
            state?: "offline" | "online" | "onlining" | "reinforced" | "unanchoring";
            /**
             * Format: int64
             * @description The solar system this starbase (POS) is in, unanchored POSes have this information
             */
            system_id: number;
            /**
             * Format: int64
             * @description Starbase (POS) type
             */
            type_id: number;
            /**
             * Format: date-time
             * @description When the POS started unanchoring, for starbases (POSes) in unanchoring state
             */
            unanchor_at?: string;
        }[];
        CorporationsCorporationIdStarbasesStarbaseIdGet: {
            allow_alliance_members: boolean;
            allow_corporation_members: boolean;
            /**
             * @description Who can anchor starbase (POS) and its structures
             * @enum {string}
             */
            anchor: "alliance_member" | "config_starbase_equipment_role" | "corporation_member" | "starbase_fuel_technician_role";
            attack_if_at_war: boolean;
            attack_if_other_security_status_dropping: boolean;
            /**
             * Format: double
             * @description Starbase (POS) will attack if target's security standing is lower than this value
             */
            attack_security_status_threshold?: number;
            /**
             * Format: double
             * @description Starbase (POS) will attack if target's standing is lower than this value
             */
            attack_standing_threshold?: number;
            /**
             * @description Who can take fuel blocks out of the starbase (POS)'s fuel bay
             * @enum {string}
             */
            fuel_bay_take: "alliance_member" | "config_starbase_equipment_role" | "corporation_member" | "starbase_fuel_technician_role";
            /**
             * @description Who can view the starbase (POS)'s fule bay. Characters either need to have required role or belong to the starbase (POS) owner's corporation or alliance, as described by the enum, all other access settings follows the same scheme
             * @enum {string}
             */
            fuel_bay_view: "alliance_member" | "config_starbase_equipment_role" | "corporation_member" | "starbase_fuel_technician_role";
            /** @description Fuel blocks and other things that will be consumed when operating a starbase (POS) */
            fuels?: {
                /** Format: int64 */
                quantity: number;
                /** Format: int64 */
                type_id: number;
            }[];
            /**
             * @description Who can offline starbase (POS) and its structures
             * @enum {string}
             */
            offline: "alliance_member" | "config_starbase_equipment_role" | "corporation_member" | "starbase_fuel_technician_role";
            /**
             * @description Who can online starbase (POS) and its structures
             * @enum {string}
             */
            online: "alliance_member" | "config_starbase_equipment_role" | "corporation_member" | "starbase_fuel_technician_role";
            /**
             * @description Who can unanchor starbase (POS) and its structures
             * @enum {string}
             */
            unanchor: "alliance_member" | "config_starbase_equipment_role" | "corporation_member" | "starbase_fuel_technician_role";
            /** @description True if the starbase (POS) is using alliance standings, otherwise using corporation's */
            use_alliance_standings: boolean;
        };
        CorporationsCorporationIdStructuresGet: {
            /**
             * Format: int64
             * @description ID of the corporation that owns the structure
             */
            corporation_id: number;
            /**
             * Format: date-time
             * @description Date on which the structure will run out of fuel
             */
            fuel_expires?: string;
            /** @description The structure name */
            name?: string;
            /**
             * Format: date-time
             * @description The date and time when the structure's newly requested reinforcement times (e.g. next_reinforce_hour and next_reinforce_day) will take effect
             */
            next_reinforce_apply?: string;
            /**
             * Format: int64
             * @description The requested change to reinforce_hour that will take effect at the time shown by next_reinforce_apply
             */
            next_reinforce_hour?: number;
            /**
             * Format: int64
             * @description The id of the ACL profile for this citadel
             */
            profile_id: number;
            /**
             * Format: int64
             * @description The hour of day that determines the four hour window when the structure will randomly exit its reinforcement periods and become vulnerable to attack against its armor and/or hull. The structure will become vulnerable at a random time that is +/- 2 hours centered on the value of this property
             */
            reinforce_hour?: number;
            /** @description Contains a list of service upgrades, and their state */
            services?: {
                name: string;
                /** @enum {string} */
                state: "online" | "offline" | "cleanup";
            }[];
            /** @enum {string} */
            state: "anchor_vulnerable" | "anchoring" | "armor_reinforce" | "armor_vulnerable" | "deploy_vulnerable" | "fitting_invulnerable" | "hull_reinforce" | "hull_vulnerable" | "online_deprecated" | "onlining_vulnerable" | "shield_vulnerable" | "unanchored" | "unknown";
            /**
             * Format: date-time
             * @description Date at which the structure will move to it's next state
             */
            state_timer_end?: string;
            /**
             * Format: date-time
             * @description Date at which the structure entered it's current state
             */
            state_timer_start?: string;
            /**
             * Format: int64
             * @description The Item ID of the structure
             */
            structure_id: number;
            /**
             * Format: int64
             * @description The solar system the structure is in
             */
            system_id: number;
            /**
             * Format: int64
             * @description The type id of the structure
             */
            type_id: number;
            /**
             * Format: date-time
             * @description Date at which the structure will unanchor
             */
            unanchors_at?: string;
        }[];
        CorporationsCorporationIdTitlesGet: {
            grantable_roles?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            grantable_roles_at_base?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            grantable_roles_at_hq?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            grantable_roles_at_other?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            name?: string;
            roles?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_base?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_hq?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            roles_at_other?: ("Account_Take_1" | "Account_Take_2" | "Account_Take_3" | "Account_Take_4" | "Account_Take_5" | "Account_Take_6" | "Account_Take_7" | "Accountant" | "Auditor" | "Brand_Manager" | "Communications_Officer" | "Config_Equipment" | "Config_Starbase_Equipment" | "Container_Take_1" | "Container_Take_2" | "Container_Take_3" | "Container_Take_4" | "Container_Take_5" | "Container_Take_6" | "Container_Take_7" | "Contract_Manager" | "Deliveries_Container_Take" | "Deliveries_Query" | "Deliveries_Take" | "Diplomat" | "Director" | "Factory_Manager" | "Fitting_Manager" | "Hangar_Query_1" | "Hangar_Query_2" | "Hangar_Query_3" | "Hangar_Query_4" | "Hangar_Query_5" | "Hangar_Query_6" | "Hangar_Query_7" | "Hangar_Take_1" | "Hangar_Take_2" | "Hangar_Take_3" | "Hangar_Take_4" | "Hangar_Take_5" | "Hangar_Take_6" | "Hangar_Take_7" | "Junior_Accountant" | "Personnel_Manager" | "Project_Manager" | "Rent_Factory_Facility" | "Rent_Office" | "Rent_Research_Facility" | "Security_Officer" | "Skill_Plan_Manager" | "Starbase_Defense_Operator" | "Starbase_Fuel_Technician" | "Station_Manager" | "Trader")[];
            /** Format: int64 */
            title_id?: number;
        }[];
        /** @description Journal entries */
        CorporationsCorporationIdWalletsDivisionJournalGet: {
            /**
             * Format: double
             * @description The amount of ISK given or taken from the wallet as a result of the given transaction. Positive when ISK is deposited into the wallet and negative when ISK is withdrawn
             */
            amount?: number;
            /**
             * Format: double
             * @description Wallet balance after transaction occurred
             */
            balance?: number;
            /**
             * Format: int64
             * @description An ID that gives extra context to the particular transaction. Because of legacy reasons the context is completely different per ref_type and means different things. It is also possible to not have a context_id
             */
            context_id?: number;
            /**
             * @description The type of the given context_id if present
             * @enum {string}
             */
            context_id_type?: "structure_id" | "station_id" | "market_transaction_id" | "character_id" | "corporation_id" | "alliance_id" | "eve_system" | "industry_job_id" | "contract_id" | "planet_id" | "system_id" | "type_id";
            /**
             * Format: date-time
             * @description Date and time of transaction
             */
            date: string;
            /** @description The reason for the transaction, mirrors what is seen in the client */
            description: string;
            /**
             * Format: int64
             * @description The id of the first party involved in the transaction. This attribute has no consistency and is different or non existant for particular ref_types. The description attribute will help make sense of what this attribute means. For more info about the given ID it can be dropped into the /universe/names/ ESI route to determine its type and name
             */
            first_party_id?: number;
            /**
             * Format: int64
             * @description Unique journal reference ID
             */
            id: number;
            /** @description The user stated reason for the transaction. Only applies to some ref_types */
            reason?: string;
            /**
             * @description "The transaction type for the given. transaction. Different transaction types will populate different attributes. Note: If you have an existing XML API application that is using ref_types, you will need to know which string ESI ref_type maps to which integer. You can look at the following file to see string->int mappings: https://github.com/ccpgames/eve-glue/blob/master/eve_glue/wallet_journal_ref.py"
             * @enum {string}
             */
            ref_type: "acceleration_gate_fee" | "achievement_category_milestone_reward" | "achievement_milestone_reward" | "advertisement_listing_fee" | "agent_donation" | "agent_location_services" | "agent_miscellaneous" | "agent_mission_collateral_paid" | "agent_mission_collateral_refunded" | "agent_mission_reward" | "agent_mission_reward_corporation_tax" | "agent_mission_security_tax" | "agent_mission_time_bonus_reward" | "agent_mission_time_bonus_reward_corporation_tax" | "agent_security_services" | "agent_services_rendered" | "agents_preward" | "air_career_program_reward" | "alliance_maintainance_fee" | "alliance_registration_fee" | "allignment_based_gate_toll" | "asset_safety_recovery_tax" | "bounty" | "bounty_prize" | "bounty_prize_corporation_tax" | "bounty_prizes" | "bounty_reimbursement" | "bounty_surcharge" | "brokers_fee" | "campaign_objective_isk_reward" | "clone_activation" | "clone_transfer" | "contraband_fine" | "contract_auction_bid" | "contract_auction_bid_corp" | "contract_auction_bid_refund" | "contract_auction_sold" | "contract_brokers_fee" | "contract_brokers_fee_corp" | "contract_collateral" | "contract_collateral_deposited_corp" | "contract_collateral_payout" | "contract_collateral_refund" | "contract_deposit" | "contract_deposit_corp" | "contract_deposit_refund" | "contract_deposit_sales_tax" | "contract_price" | "contract_price_payment_corp" | "contract_reversal" | "contract_reward" | "contract_reward_deposited" | "contract_reward_deposited_corp" | "contract_reward_refund" | "contract_sales_tax" | "copying" | "corporate_reward_payout" | "corporate_reward_tax" | "corporation_account_withdrawal" | "corporation_bulk_payment" | "corporation_dividend_payment" | "corporation_liquidation" | "corporation_logo_change_cost" | "corporation_payment" | "corporation_registration_fee" | "cosmetic_market_component_item_purchase" | "cosmetic_market_skin_purchase" | "cosmetic_market_skin_sale" | "cosmetic_market_skin_sale_broker_fee" | "cosmetic_market_skin_sale_tax" | "cosmetic_market_skin_transaction" | "courier_mission_escrow" | "cspa" | "cspaofflinerefund" | "daily_challenge_reward" | "daily_goal_payouts" | "daily_goal_payouts_tax" | "datacore_fee" | "dna_modification_fee" | "docking_fee" | "duel_wager_escrow" | "duel_wager_payment" | "duel_wager_refund" | "ess_escrow_transfer" | "external_trade_delivery" | "external_trade_freeze" | "external_trade_thaw" | "factory_slot_rental_fee" | "flux_payout" | "flux_tax" | "flux_ticket_repayment" | "flux_ticket_sale" | "freelance_jobs_broadcasting_fee" | "freelance_jobs_duration_fee" | "freelance_jobs_escrow_refund" | "freelance_jobs_reward" | "freelance_jobs_reward_corporation_tax" | "freelance_jobs_reward_escrow" | "gm_cash_transfer" | "gm_plex_fee_refund" | "industry_job_tax" | "industry_security_tax" | "infrastructure_hub_maintenance" | "inheritance" | "insurance" | "insurgency_corruption_contribution_reward" | "insurgency_suppression_contribution_reward" | "item_trader_payment" | "jump_clone_activation_fee" | "jump_clone_installation_fee" | "kill_right_fee" | "lp_store" | "manufacturing" | "market_escrow" | "market_fine_paid" | "market_provider_tax" | "market_security_tax" | "market_transaction" | "medal_creation" | "medal_issued" | "milestone_reward_payment" | "mission_completion" | "mission_cost" | "mission_expiration" | "mission_reward" | "npc_bounty_security_tax" | "office_rental_fee" | "operation_bonus" | "opportunity_reward" | "planetary_construction" | "planetary_export_tax" | "planetary_import_tax" | "player_donation" | "player_trading" | "project_discovery_reward" | "project_discovery_tax" | "project_payouts" | "reaction" | "redeemed_isk_token" | "release_of_impounded_property" | "repair_bill" | "reprocessing_tax" | "researching_material_productivity" | "researching_technology" | "researching_time_productivity" | "resource_wars_reward" | "reverse_engineering" | "season_challenge_reward" | "security_processing_fee" | "shares" | "skill_purchase" | "skyhook_claim_fee" | "sovereignity_bill" | "store_purchase" | "store_purchase_refund" | "structure_gate_jump" | "transaction_tax" | "under_construction" | "upkeep_adjustment_fee" | "war_ally_contract" | "war_fee" | "war_fee_surrender";
            /**
             * Format: int64
             * @description The id of the second party involved in the transaction. This attribute has no consistency and is different or non existant for particular ref_types. The description attribute will help make sense of what this attribute means. For more info about the given ID it can be dropped into the /universe/names/ ESI route to determine its type and name
             */
            second_party_id?: number;
            /**
             * Format: double
             * @description Tax amount received. Only applies to tax related transactions
             */
            tax?: number;
            /**
             * Format: int64
             * @description The corporation ID receiving any tax paid. Only applies to tax related transactions
             */
            tax_receiver_id?: number;
        }[];
        /** @description Wallet transactions */
        CorporationsCorporationIdWalletsDivisionTransactionsGet: {
            /** Format: int64 */
            client_id: number;
            /**
             * Format: date-time
             * @description Date and time of transaction
             */
            date: string;
            is_buy: boolean;
            /**
             * Format: int64
             * @description -1 if there is no corresponding wallet journal entry
             */
            journal_ref_id: number;
            /** Format: int64 */
            location_id: number;
            /** Format: int64 */
            quantity: number;
            /**
             * Format: int64
             * @description Unique transaction ID
             */
            transaction_id: number;
            /** Format: int64 */
            type_id: number;
            /**
             * Format: double
             * @description Amount paid per unit
             */
            unit_price: number;
        }[];
        CorporationsCorporationIdWalletsGet: {
            /** Format: double */
            balance: number;
            /** Format: int64 */
            division: number;
        }[];
        CorporationsDetail: {
            /** @description Alliance the corporation is a member of (Player-owned corporation only) */
            alliance_id?: components["schemas"]["AllianceID"];
            /** @description Corporation's CEO ID */
            ceo_id?: components["schemas"]["CharacterID"];
            /** @description Corporation's creator ID */
            creator_id?: components["schemas"]["CharacterID"];
            /**
             * Format: date-time
             * @description Corporation's founding date
             */
            date_founded?: string;
            /** @description Corporation's description */
            description: string;
            /** @description Faction the corporation is enlisted in (Player-owned corporation only) */
            enlisted_faction_id?: components["schemas"]["FactionID"];
            /**
             * @description Corporation's friendly fire status
             * @enum {string}
             */
            friendly_fire: "legal" | "illegal";
            /** @description Corporation's home station ID */
            home_station_id: components["schemas"]["StationID"];
            /**
             * Format: int64
             * @description Corporation's member count
             * @example 100
             */
            member_count: number;
            /** @description Corporation's name */
            name: string;
            /** @description Corporation's palette colors (Player-owned corporation only) */
            palette?: components["schemas"]["CorporationsDetailPalette"];
            /**
             * Format: int64
             * @description Corporation's shares
             * @example 1000
             */
            shares: number;
            /**
             * @description Corporation's state
             * @enum {string}
             */
            state: "active" | "closed";
            /** @description Corporation's tax rates */
            tax_rates: components["schemas"]["CorporationsDetailTaxrates"];
            /** @description Corporation's short name */
            ticker: string;
            /**
             * @description Corporation's type
             * @enum {string}
             */
            type: "player_owned" | "npc_owned";
            /** @description Corporation's URL */
            url?: string;
            /** @description Corporation's war eligible */
            war_eligible: boolean;
        };
        CorporationsDetailPalette: {
            /** @description Main palette color (#rrggbb) */
            main_color: string;
            /** @description Secondary palette color (#rrggbb) */
            secondary_color?: string;
            /** @description Tertiary palette color (#rrggbb) */
            tertiary_color?: string;
        };
        CorporationsDetailTaxrates: {
            /**
             * Format: double
             * @description ISK tax rate (0.0% - 100.0%)
             * @example 10
             */
            isk: number;
            /**
             * Format: double
             * @description Loyalty point tax rate (0.0% - 100.0%)
             * @example 5.6
             */
            loyalty_point: number;
        };
        CorporationsFreelanceJobsListing: {
            cursor?: components["schemas"]["Cursor"];
            /** @description List of freelance jobs */
            freelance_jobs: components["schemas"]["FreelanceJobsDetailFreelancejob"][];
        };
        CorporationsFreelanceJobsParticipants: {
            cursor?: components["schemas"]["Cursor"];
            /** @description List of participants */
            participants: components["schemas"]["CorporationsFreelanceJobsParticipantsParticipant"][];
        };
        CorporationsFreelanceJobsParticipantsParticipant: {
            /**
             * Format: int64
             * @description Participant's contributed progress
             * @example 100
             */
            contributed: number;
            /** @description Participant's character ID */
            id: components["schemas"]["CharacterID"];
            /**
             * @description Participant's name
             * @example Participant Name
             */
            name: string;
            /**
             * @description Participant's state
             * @example Committed
             * @enum {string}
             */
            state: "Unspecified" | "Committed" | "Kicked" | "Resigned";
        };
        CorporationsNpccorpsGet: number[];
        CorporationsProjectsContribution: {
            /**
             * Format: int64
             * @description Your contribution
             * @example 10
             */
            contributed: number;
            /**
             * Format: date-time
             * @description Moment this information was last modified
             * @example 2025-08-26T00:00:00Z
             */
            last_modified?: string;
        };
        CorporationsProjectsContributors: {
            /** @description List of contributors */
            contributors: components["schemas"]["CorporationsProjectsContributorsContributor"][];
            cursor?: components["schemas"]["Cursor"];
        };
        CorporationsProjectsContributorsContributor: {
            /**
             * Format: int64
             * @description Contributor's contributed progress
             * @example 10
             */
            contributed: number;
            /** @description Contributor's character ID */
            id: components["schemas"]["CharacterID"];
            /**
             * @description Contributor's name
             * @example Contributor Name
             */
            name: string;
        };
        CorporationsProjectsDetail: {
            /** @description Project's configuration */
            configuration: {
                /** @description Capture factional warfare complex */
                capture_fw_complex?: components["schemas"]["CorporationsProjectsDetailConfigurationcapturefwcomplex"];
            } | {
                /** @description Damage ship */
                damage_ship?: components["schemas"]["CorporationsProjectsDetailConfigurationdamageship"];
            } | {
                /** @description Defend factional warfare complex */
                defend_fw_complex?: components["schemas"]["CorporationsProjectsDetailConfigurationdefendfwcomplex"];
            } | {
                /** @description Deliver item */
                deliver_item?: components["schemas"]["CorporationsProjectsDetailConfigurationdeliveritem"];
            } | {
                /** @description Destroy NPC */
                destroy_npc?: components["schemas"]["CorporationsProjectsDetailConfigurationdestroynpc"];
            } | {
                /** @description Destroy ship */
                destroy_ship?: components["schemas"]["CorporationsProjectsDetailConfigurationdestroyship"];
            } | {
                /** @description Earn loyalty point */
                earn_loyalty_point?: components["schemas"]["CorporationsProjectsDetailConfigurationearnloyaltypoints"];
            } | {
                /** @description Lost ship */
                lost_ship?: components["schemas"]["CorporationsProjectsDetailConfigurationlostship"];
            } | {
                /** @description Manual contribution */
                manual?: components["schemas"]["CorporationsProjectsDetailConfigurationmanual"];
            } | {
                /** @description Manufacture item */
                manufacture_item?: components["schemas"]["CorporationsProjectsDetailConfigurationmanufactureitem"];
            } | {
                /** @description Mine material */
                mine_material?: components["schemas"]["CorporationsProjectsDetailConfigurationminematerial"];
            } | {
                /** @description Remote boost shield */
                remote_boost_shield?: components["schemas"]["CorporationsProjectsDetailConfigurationremoteboostshield"];
            } | {
                /** @description Remote repair armor */
                remote_repair_armor?: components["schemas"]["CorporationsProjectsDetailConfigurationremoterepairarmor"];
            } | {
                /** @description Salvage wreck */
                salvage_wreck?: components["schemas"]["CorporationsProjectsDetailConfigurationsalvagewreck"];
            } | {
                /** @description Scan signature */
                scan_signature?: components["schemas"]["CorporationsProjectsDetailConfigurationscansignature"];
            } | {
                /** @description Ship insurance */
                ship_insurance?: components["schemas"]["CorporationsProjectsDetailConfigurationshipinsurance"];
            } | {
                /** @description Unknown */
                unknown?: components["schemas"]["CorporationsProjectsDetailConfigurationunknown"];
            };
            /** @description Project's contribution settings */
            contribution?: components["schemas"]["CorporationsProjectsDetailContribution"];
            /** @description Project's creator */
            creator: components["schemas"]["CorporationsProjectsDetailCreator"];
            /** @description Project's details */
            details: components["schemas"]["CorporationsProjectsDetailDetails"];
            /** @description Project's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description Moment this project was last modified. Project contributions also count as a modification
             * @example 2025-06-01T00:00:00Z
             */
            last_modified: string;
            /**
             * @description Project's name
             * @example Project Name
             */
            name: string;
            /** @description Project's progress */
            progress: components["schemas"]["CorporationsProjectsDetailProgress"];
            /** @description Project's reward */
            reward?: components["schemas"]["CorporationsProjectsDetailReward"];
            /**
             * @description Project's current state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Closed" | "Completed" | "Expired" | "Deleted";
        };
        CorporationsProjectsDetailConfigurationcapturefwcomplex: {
            /** @description Archetype of complex */
            archetypes?: components["schemas"]["CorporationsProjectsDetailConfigurationmatcherarchetype"][];
            /** @description Faction to capture for */
            factions?: components["schemas"]["CorporationsProjectsDetailConfigurationmatcherfaction"][];
            /** @description Location of complex */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationdamageship: {
            /** @description Identity of capsuleer */
            identities?: ({
                /** @description Character's ID */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation's ID */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance's ID */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Faction's ID */
                faction_id?: components["schemas"]["FactionID"];
            })[];
            /** @description Location of capsuleer's ship */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Ship-type of capsuleer's ship */
            ships?: ({
                /** @description Ship's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ship's ship tree group ID */
                group_id?: components["schemas"]["ShipTreeGroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationdefendfwcomplex: {
            /** @description Archetype of complex */
            archetypes?: components["schemas"]["CorporationsProjectsDetailConfigurationmatcherarchetype"][];
            /** @description Faction to defend for */
            factions?: components["schemas"]["CorporationsProjectsDetailConfigurationmatcherfaction"][];
            /** @description Location of complex */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationdeliveritem: {
            /** @description Docking location to deliver to */
            docking_locations?: ({
                /** @description Structure's ID */
                structure_id?: components["schemas"]["ItemID"];
            } | {
                /** @description Station's ID */
                station_id?: components["schemas"]["StationID"];
            })[];
            /** @description Item to deliver */
            items?: ({
                /** @description Item's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Item's group ID */
                group_id?: components["schemas"]["GroupID"];
            })[];
            /** @description Office to deliver to */
            office_id?: components["schemas"]["ItemID"];
        };
        CorporationsProjectsDetailConfigurationdestroynpc: {
            /** @description Location of non-capsuleer */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationdestroyship: {
            /** @description Identity of capsuleer */
            identities?: ({
                /** @description Character's ID */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation's ID */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance's ID */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Faction's ID */
                faction_id?: components["schemas"]["FactionID"];
            })[];
            /** @description Location of capsuleer's ship */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Ship-type of capsuleer's ship */
            ships?: ({
                /** @description Ship's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ship's ship tree group ID */
                group_id?: components["schemas"]["ShipTreeGroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationearnloyaltypoints: {
            /** @description Corporation issuing loyalty points */
            corporations?: components["schemas"]["CorporationsProjectsDetailConfigurationmatchercorporation"][];
        };
        CorporationsProjectsDetailConfigurationlostship: {
            /** @description Identity of killer */
            identities?: ({
                /** @description Character's ID */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation's ID */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance's ID */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Faction's ID */
                faction_id?: components["schemas"]["FactionID"];
            })[];
            /** @description Location of lost ship */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Ship-type of lost ship */
            ships?: ({
                /** @description Ship's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ship's ship tree group ID */
                group_id?: components["schemas"]["ShipTreeGroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationmanual: Record<string, never>;
        CorporationsProjectsDetailConfigurationmanufactureitem: {
            /** @description Station / structure to manufacture in */
            docking_locations?: ({
                /** @description Structure's ID */
                structure_id?: components["schemas"]["ItemID"];
            } | {
                /** @description Station's ID */
                station_id?: components["schemas"]["StationID"];
            })[];
            /** @description Item to manufacture */
            items?: ({
                /** @description Item's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Item's group ID */
                group_id?: components["schemas"]["GroupID"];
            })[];
            /**
             * @description Manufacture for
             * @enum {string}
             */
            owner: "Any" | "Corporation" | "Character";
        };
        CorporationsProjectsDetailConfigurationmatcherarchetype: {
            /** @description Archetype's ID */
            archetype_id?: components["schemas"]["ArchetypeID"];
        };
        CorporationsProjectsDetailConfigurationmatchercorporation: {
            /** @description Corporation's ID */
            corporation_id?: components["schemas"]["CorporationID"];
        };
        CorporationsProjectsDetailConfigurationmatcherfaction: {
            /** @description Faction's ID */
            faction_id?: components["schemas"]["FactionID"];
        };
        CorporationsProjectsDetailConfigurationmatchersignature: {
            /** @description Signature type's ID */
            signature_type_id?: components["schemas"]["AttributeID"];
        };
        CorporationsProjectsDetailConfigurationminematerial: {
            /** @description Location to mine */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Materials to mine */
            materials?: ({
                /** @description Ore's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ore's group ID */
                group_id?: components["schemas"]["GroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationremoteboostshield: {
            /** @description Identity of capsuleer to boost */
            identities?: ({
                /** @description Character's ID */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation's ID */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance's ID */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Faction's ID */
                faction_id?: components["schemas"]["FactionID"];
            })[];
            /** @description Location of capsuleer's ship to boost */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Ship-type of capsuleer's ship to boost */
            ships?: ({
                /** @description Ship's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ship's ship tree group ID */
                group_id?: components["schemas"]["ShipTreeGroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationremoterepairarmor: {
            /** @description Identity of capsuleer to repair */
            identities?: ({
                /** @description Character's ID */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation's ID */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance's ID */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Faction's ID */
                faction_id?: components["schemas"]["FactionID"];
            })[];
            /** @description Location of capsuleer's ship to repair */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Ship-type of capsuleer's ship to repair */
            ships?: ({
                /** @description Ship's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ship's ship tree group ID */
                group_id?: components["schemas"]["ShipTreeGroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationsalvagewreck: {
            /** @description Location of wreck */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationscansignature: {
            /** @description Locations of signatures */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Signatures to scan */
            signatures?: components["schemas"]["CorporationsProjectsDetailConfigurationmatchersignature"][];
        };
        CorporationsProjectsDetailConfigurationshipinsurance: {
            /**
             * @description Conflict type
             * @enum {string}
             */
            conflict_type: "Any" | "Pvp" | "Pve";
            /** @description Identity of killer */
            identities?: ({
                /** @description Character's ID */
                character_id?: components["schemas"]["CharacterID"];
            } | {
                /** @description Corporation's ID */
                corporation_id?: components["schemas"]["CorporationID"];
            } | {
                /** @description Alliance's ID */
                alliance_id?: components["schemas"]["AllianceID"];
            } | {
                /** @description Faction's ID */
                faction_id?: components["schemas"]["FactionID"];
            })[];
            /** @description Location of lost ship */
            locations?: ({
                /** @description Solar system's ID */
                solar_system_id?: components["schemas"]["SolarSystemID"];
            } | {
                /** @description Constellation's ID */
                constellation_id?: components["schemas"]["ConstellationID"];
            } | {
                /** @description Region's ID */
                region_id?: components["schemas"]["RegionID"];
            })[];
            /** @description Reimburse implants */
            reimburse_implants: boolean;
            /** @description Ship-type of lost ship */
            ships?: ({
                /** @description Ship's type ID */
                type_id?: components["schemas"]["TypeID"];
            } | {
                /** @description Ship's ship tree group ID */
                group_id?: components["schemas"]["ShipTreeGroupID"];
            })[];
        };
        CorporationsProjectsDetailConfigurationunknown: {
            /**
             * @description JSON-encoded configuration
             * @example {}
             */
            data: unknown;
            /**
             * @description Configuration type
             * @example projectType
             */
            type: string;
        };
        CorporationsProjectsDetailContribution: {
            /**
             * Format: int64
             * @description Limit on the contribution of the individual participant
             * @example 1000
             */
            participation_limit?: number;
            /**
             * Format: double
             * @description ISK reward per contribution
             * @example 123.5
             */
            reward_per_contribution?: number;
            /**
             * Format: int64
             * @description Limit on amount of contribution per submission
             * @example 100
             */
            submission_limit?: number;
            /**
             * Format: double
             * @description Multiplier towards progress per contribution
             * @example 1.5
             */
            submission_multiplier?: number;
        };
        CorporationsProjectsDetailCreator: {
            /** @description Creator's character ID */
            id: components["schemas"]["CharacterID"];
            /**
             * @description Creator's name
             * @example Creator Name
             */
            name: string;
        };
        CorporationsProjectsDetailDetails: {
            /**
             * @description Assigned career path
             * @example Explorer
             * @enum {string}
             */
            career: "Unspecified" | "Explorer" | "Industrialist" | "Enforcer" | "Soldier of Fortune";
            /**
             * Format: date-time
             * @description Moment this project was created
             * @example 2025-06-01T00:00:00Z
             */
            created: string;
            /**
             * @description Description
             * @example Project Description
             */
            description: string;
            /**
             * Format: date-time
             * @description Moment this project expires
             * @example 2025-06-01T00:01:00Z
             */
            expires?: string;
            /**
             * Format: date-time
             * @description Moment this project transitioned to a non-active state.
             * @example 2025-06-01T00:00:00Z
             */
            finished?: string;
        };
        CorporationsProjectsDetailProgress: {
            /**
             * Format: int64
             * @description Current progress
             * @example 50
             */
            current: number;
            /**
             * Format: int64
             * @description Desired progress
             * @example 100
             */
            desired: number;
        };
        CorporationsProjectsDetailProject: {
            /** @description Project's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description Moment this project was last modified. Project contributions also count as a modification
             * @example 2025-06-01T00:00:00Z
             */
            last_modified: string;
            /**
             * @description Project's name
             * @example Project Name
             */
            name: string;
            /** @description Project's progress */
            progress: components["schemas"]["CorporationsProjectsDetailProgress"];
            /** @description Project's reward */
            reward?: components["schemas"]["CorporationsProjectsDetailReward"];
            /**
             * @description Project's current state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Closed" | "Completed" | "Expired" | "Deleted";
        };
        CorporationsProjectsDetailReward: {
            /**
             * Format: double
             * @description Original amount of ISK that was reserved for this project
             * @example 12345.5
             */
            initial: number;
            /**
             * Format: double
             * @description Remaining ISK to be awarded
             * @example 5432.1
             */
            remaining: number;
        };
        CorporationsProjectsListing: {
            cursor?: components["schemas"]["Cursor"];
            /** @description List of projects */
            projects: components["schemas"]["CorporationsProjectsDetailProject"][];
        };
        CorporationsStructuresSkyhooksDetail: {
            /**
             * Format: int64
             * @description Skyhook's effective workforce; this can differ from the Skyhook's normal workforce due to the influence of an attached Mercenary Den
             * @example 1000
             */
            effective_workforce?: number;
            /** @description Skyhook's ID */
            id: components["schemas"]["ItemID"];
            /** @description Whether the Skyhook is active and producing workforce/power/reagents */
            is_active: boolean;
            /** @description ID of the planet the Skyhook is anchored on */
            planet_id: components["schemas"]["PlanetID"];
            /** @description Skyhook's reagents */
            reagents?: components["schemas"]["CorporationsStructuresSkyhooksDetailReagent"][];
            /** @description Skyhook's reinforcement timer (if the structure is reinforced) */
            reinforcement_timer?: components["schemas"]["CorporationsStructuresSkyhooksDetailReinforcementtimer"];
            /**
             * @description Skyhook's state
             * @enum {string}
             */
            state: "Unspecified" | "ShieldVulnerable" | "ArmorReinforced" | "ArmorVulnerable" | "HullReinforced" | "HullVulnerable";
            /** @description Skyhook's theft vulnerability */
            theft_vulnerability?: components["schemas"]["CorporationsStructuresSkyhooksDetailTheftvulnerability"];
        };
        CorporationsStructuresSkyhooksDetailReagent: {
            /**
             * Format: date-time
             * @description Moment the 'SecureStock'/'UnsecuredStock' value had its last cycle; use SDE to calculate the current values
             * @example 2026-02-23T12:00:00Z
             */
            last_cycle: string;
            /**
             * Format: int64
             * @description Secured stock of the reagent at the time of 'last_cycle'
             * @example 1000
             */
            secured_stock: number;
            /** @description Reagent's type ID */
            type_id: components["schemas"]["TypeID"];
            /**
             * Format: int64
             * @description Unsecured stock of the reagent at the time of 'last_cycle'
             * @example 300
             */
            unsecured_stock: number;
        };
        CorporationsStructuresSkyhooksDetailReinforcementtimer: {
            /**
             * Format: date-time
             * @description The time when the reinforcement timer will end
             * @example 2026-02-23T16:00:00Z
             */
            end: string;
        };
        CorporationsStructuresSkyhooksDetailTheftvulnerability: {
            /**
             * Format: date-time
             * @description End time of the theft vulnerability window
             * @example 2026-02-23T16:00:00Z
             */
            end: string;
            /**
             * Format: date-time
             * @description Start time of the theft vulnerability window
             * @example 2026-02-23T12:00:00Z
             */
            start: string;
        };
        CorporationsStructuresSkyhooksListing: {
            /** @description List of Skyhooks */
            skyhooks: components["schemas"]["CorporationsStructuresSkyhooksListingSkyhook"][];
        };
        CorporationsStructuresSkyhooksListingSkyhook: {
            /** @description Skyhook's ID */
            id: components["schemas"]["ItemID"];
            /** @description ID of the planet the Skyhook is anchored on */
            planet_id: components["schemas"]["PlanetID"];
        };
        CorporationsStructuresSovereigntyHubsDetail: {
            /** @description Access List with who can manage Sovereignty Hub's fuel */
            fuel_access_list_id?: components["schemas"]["AccessListID"];
            /** @description Sovereignty Hub's ID */
            id: components["schemas"]["ItemID"];
            /** @description Sovereignty Hub's reagent bay */
            reagent_bay: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailReagentbay"];
            /** @description Sovereignty Hub's resources */
            resources: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailResources"];
            /** @description Sovereignty Hub's solar system ID */
            solar_system_id: components["schemas"]["SolarSystemID"];
            /** @description Sovereignty Hub's installed upgrades */
            upgrades: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailUpgrade"][];
            /** @description Sovereignty Hub's vulnerability window; if omitted, this Sovereignty Hub is part of an active campaign */
            vulnerability_window?: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailVulnerabilitywindow"];
            /** @description Sovereignty Hub's workforce transport settings */
            workforce_transport: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransport"];
        };
        CorporationsStructuresSovereigntyHubsDetailReagent: {
            /**
             * Format: int64
             * @description Amount of reagent in the bay at the time of 'last_updated'
             * @example 1000
             */
            amount: number;
            /**
             * Format: int64
             * @description Amount of reagent burning per hour
             * @example 10
             */
            burning_per_hour: number;
            /** @description Reagent's type ID */
            type_id: components["schemas"]["TypeID"];
        };
        CorporationsStructuresSovereigntyHubsDetailReagentbay: {
            /**
             * Format: date-time
             * @description Moment the 'amount' value was last updated; use 'burning_per_hour' to calculate the current value
             * @example 2026-02-23T12:00:00Z
             */
            last_updated: string;
            /** @description Sovereignty Hub's reagents */
            reagents: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailReagent"][];
        };
        CorporationsStructuresSovereigntyHubsDetailResourcepower: {
            /**
             * Format: int64
             * @description Allocated power
             * @example 100
             */
            allocated: number;
            /**
             * Format: int64
             * @description Available power
             * @example 1000
             */
            available: number;
        };
        CorporationsStructuresSovereigntyHubsDetailResources: {
            /** @description Sovereignty Hub's power */
            power: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailResourcepower"];
            /** @description Sovereignty Hub's workforce */
            workforce: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailResourceworkforce"];
        };
        CorporationsStructuresSovereigntyHubsDetailResourceworkforce: {
            /**
             * Format: int64
             * @description Allocated workforce
             * @example 100
             */
            allocated: number;
            /**
             * Format: int64
             * @description Available workforce
             * @example 1000
             */
            available: number;
        };
        CorporationsStructuresSovereigntyHubsDetailTransport: {
            /** @description Configured workforce transport */
            configuration: {
                /** @description Workforce is requested to be imported */
                import?: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransportconfigurationimport"];
            } | {
                /** @description Workforce is requested to be exported */
                export?: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransportconfigurationexport"];
            } | {
                /** @description Workforce is requested to be brought to transit */
                transit?: boolean | null;
            };
            /** @description Current state of the workforce transport */
            state: {
                /** @description Workforce is being imported */
                import?: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransportstateimport"];
            } | {
                /** @description Workforce is being exported */
                export?: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransportstateexport"];
            } | {
                /** @description Workforce is being brought to transit */
                transit?: boolean | null;
            };
        };
        CorporationsStructuresSovereigntyHubsDetailTransportconfigurationexport: {
            /**
             * Format: int64
             * @description Amount to be exported
             * @example 1000
             */
            amount: number;
            /** @description Destination's solar system ID */
            solar_system_id?: components["schemas"]["SolarSystemID"];
        };
        CorporationsStructuresSovereigntyHubsDetailTransportconfigurationimport: {
            /** @description Sources */
            sources: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransportconfigurationsource"][];
        };
        CorporationsStructuresSovereigntyHubsDetailTransportconfigurationsource: {
            /** @description Source's solar system ID */
            solar_system_id: components["schemas"]["SolarSystemID"];
        };
        CorporationsStructuresSovereigntyHubsDetailTransportstateexport: {
            /**
             * Format: int64
             * @description Amount exported
             * @example 1000
             */
            amount?: number;
            /** @description Destination's solar system ID */
            solar_system_id?: components["schemas"]["SolarSystemID"];
        };
        CorporationsStructuresSovereigntyHubsDetailTransportstateimport: {
            /** @description Sources */
            sources: components["schemas"]["CorporationsStructuresSovereigntyHubsDetailTransportstateimportsource"][];
        };
        CorporationsStructuresSovereigntyHubsDetailTransportstateimportsource: {
            /**
             * Format: int64
             * @description Amount imported
             * @example 1000
             */
            amount: number;
            /** @description Source's solar system ID */
            solar_system_id: components["schemas"]["SolarSystemID"];
        };
        CorporationsStructuresSovereigntyHubsDetailUpgrade: {
            /**
             * @description Upgrade's power state
             * @enum {string}
             */
            power_state: "Unspecified" | "Online" | "Offline" | "Low" | "Pending";
            /** @description Upgrade's type ID */
            type_id: components["schemas"]["TypeID"];
        };
        CorporationsStructuresSovereigntyHubsDetailVulnerabilitywindow: {
            /**
             * Format: date-time
             * @description End time of the vulnerability window; if in the past, the Sovereignty Hub is in overtime
             * @example 2026-02-23T16:00:00Z
             */
            end: string;
            /**
             * Format: date-time
             * @description Start time of the vulnerability window; if in the past, the Sovereignty Hub is vulnerable right now
             * @example 2026-02-23T12:00:00Z
             */
            start: string;
        };
        CorporationsStructuresSovereigntyHubsListing: {
            /** @description List of Sovereignty Hubs */
            sovereignty_hubs: components["schemas"]["CorporationsStructuresSovereigntyHubsListingSovereigntyhub"][];
        };
        CorporationsStructuresSovereigntyHubsListingSovereigntyhub: {
            /** @description Sovereignty Hub's ID */
            id: components["schemas"]["ItemID"];
            /** @description Sovereignty Hub's location */
            solar_system_id: components["schemas"]["SolarSystemID"];
        };
        CosmeticsSkinr: {
            /** @description SKINR creator character ID */
            creator_id: components["schemas"]["CharacterID"];
            /** @description SKINR ID */
            id: string;
            /** @description SKINR layout */
            layout: components["schemas"]["CosmeticsSkinrLayout"];
            /** @description SKINR line name */
            line?: string;
            /** @description SKINR name */
            name: string;
            /**
             * @description ID of the ship hull
             * @example 587
             */
            ship_type_id: components["schemas"]["TypeID"];
            /** @description SKINR tier */
            tier: components["schemas"]["CosmeticsSkinrTier"];
        };
        CosmeticsSkinrLayout: {
            /**
             * @description Blend mode to use when compositing patterns
             * @enum {string}
             */
            pattern_blend_mode: "normal" | "subtract" | "exclusion" | "nested" | "nested_inverted";
            /** @description Cosmetic slots in the layout */
            slots: components["schemas"]["CosmeticsSkinrLayoutslot"][];
        };
        CosmeticsSkinrLayoutslot: {
            /** @description Configuration of the cosmetic slot */
            configuration: {
                /** @description Nanocoating configuration */
                nanocoating?: components["schemas"]["CosmeticsSkinrSlotnanocoating"];
            } | {
                /** @description Pattern configuration */
                pattern?: components["schemas"]["CosmeticsSkinrSlotpattern"];
            };
            /**
             * Format: int64
             * @description ID of cosmetic slot (see SDE for details)
             * @example 1
             */
            id: number;
        };
        CosmeticsSkinrPatternconfiguration: {
            /** @description Whether to mirror the UV coordinates */
            mirrored: boolean;
            /** @description How the pattern is mapped onto the ship hull */
            projection: components["schemas"]["CosmeticsSkinrPatternprojection"];
            /** @description Transformation applied to the pattern */
            transform: components["schemas"]["CosmeticsSkinrPatterntransform"];
        };
        CosmeticsSkinrPatternprojection: {
            /** @description Whether the pattern is projected on cosmetic slot 1 */
            slot1: boolean;
            /** @description Whether the pattern is projected on cosmetic slot 2 */
            slot2: boolean;
            /** @description Whether the pattern is projected on cosmetic slot 3 */
            slot3: boolean;
            /** @description Whether the pattern is projected on cosmetic slot 4 */
            slot4: boolean;
        };
        CosmeticsSkinrPatterntransform: {
            /** @description Translation applied to the pattern */
            position: components["schemas"]["CosmeticsSkinrVector3"];
            /** @description Rotation applied to the pattern */
            rotation: components["schemas"]["CosmeticsSkinrVector4"];
            /** @description Scaling applied to the pattern */
            scaling: components["schemas"]["CosmeticsSkinrVector3"];
        };
        CosmeticsSkinrSlotnanocoating: {
            /**
             * Format: int64
             * @description ID of nanocoating component (see SDE for details)
             * @example 67890
             */
            id: number;
        };
        CosmeticsSkinrSlotpattern: {
            /** @description Pattern component configuration */
            configuration: components["schemas"]["CosmeticsSkinrPatternconfiguration"];
            /**
             * Format: int64
             * @description ID of pattern component (see SDE for details)
             * @example 67890
             */
            id: number;
        };
        CosmeticsSkinrTier: {
            /**
             * Format: int64
             * @description SKINR tier level
             * @example 1
             */
            level: number;
        };
        CosmeticsSkinrVector3: {
            /**
             * Format: double
             * @description X coordinate
             * @example 0
             */
            x: number;
            /**
             * Format: double
             * @description Y coordinate
             * @example 0
             */
            y: number;
            /**
             * Format: double
             * @description Z coordinate
             * @example 0
             */
            z: number;
        };
        CosmeticsSkinrVector4: {
            /**
             * Format: double
             * @description W coordinate
             * @example 1
             */
            w: number;
            /**
             * Format: double
             * @description X coordinate
             * @example 1
             */
            x: number;
            /**
             * Format: double
             * @description Y coordinate
             * @example 0
             */
            y: number;
            /**
             * Format: double
             * @description Z coordinate
             * @example 0
             */
            z: number;
        };
        Cursor: {
            /** @description Cursor to use as 'after' in your next request, to continue walking forwards in time. */
            after?: string;
            /** @description Cursor to use as 'before' in your next request, to continue walking backwards in time. */
            before?: string;
        };
        DogmaAttributesAttributeIdGet: {
            /** Format: int64 */
            attribute_id: number;
            /** Format: double */
            default_value?: number;
            description?: string;
            display_name?: string;
            high_is_good?: boolean;
            /** Format: int64 */
            icon_id?: number;
            name?: string;
            published?: boolean;
            stackable?: boolean;
            /** Format: int64 */
            unit_id?: number;
        };
        DogmaAttributesGet: number[];
        DogmaDynamicItemsTypeIdItemIdGet: {
            /**
             * Format: int64
             * @description The ID of the character who created the item
             */
            created_by: number;
            dogma_attributes: {
                /** Format: int64 */
                attribute_id: number;
                /** Format: double */
                value: number;
            }[];
            dogma_effects: {
                /** Format: int64 */
                effect_id: number;
                is_default: boolean;
            }[];
            /**
             * Format: int64
             * @description The type ID of the mutator used to generate the dynamic item.
             */
            mutator_type_id: number;
            /**
             * Format: int64
             * @description The type ID of the source item the mutator was applied to create the dynamic item.
             */
            source_type_id: number;
        };
        DogmaEffectsEffectIdGet: {
            description?: string;
            disallow_auto_repeat?: boolean;
            /** Format: int64 */
            discharge_attribute_id?: number;
            display_name?: string;
            /** Format: int64 */
            duration_attribute_id?: number;
            /** Format: int64 */
            effect_category?: number;
            /** Format: int64 */
            effect_id: number;
            electronic_chance?: boolean;
            /** Format: int64 */
            falloff_attribute_id?: number;
            /** Format: int64 */
            icon_id?: number;
            is_assistance?: boolean;
            is_offensive?: boolean;
            is_warp_safe?: boolean;
            modifiers?: {
                domain?: string;
                /** Format: int64 */
                effect_id?: number;
                func: string;
                /** Format: int64 */
                modified_attribute_id?: number;
                /** Format: int64 */
                modifying_attribute_id?: number;
                /** Format: int64 */
                operator?: number;
            }[];
            name?: string;
            /** Format: int64 */
            post_expression?: number;
            /** Format: int64 */
            pre_expression?: number;
            published?: boolean;
            /** Format: int64 */
            range_attribute_id?: number;
            range_chance?: boolean;
            /** Format: int64 */
            tracking_speed_attribute_id?: number;
        };
        DogmaEffectsGet: number[];
        /**
         * Format: int64
         * @example 12367
         */
        DungeonID: number;
        Error: {
            /** @description List of individual issues. */
            details?: components["schemas"]["ErrorDetail"][];
            /** @description Error message. */
            error: string;
            /**
             * Format: int64
             * @description HTTP status code.
             */
            status?: number;
        };
        ErrorDetail: {
            /** @description Where the error occurred, e.g. 'body.items[3].tags' or 'path.thing-id' */
            location?: string;
            /** @description Error message text */
            message?: string;
            /** @description The value at the given location */
            value?: unknown;
        };
        /**
         * Format: int64
         * @example 500002
         */
        FactionID: number;
        FleetsFleetIdGet: {
            /** @description Is free-move enabled */
            is_free_move: boolean;
            /** @description Does the fleet have an active fleet advertisement */
            is_registered: boolean;
            /** @description Is EVE Voice enabled */
            is_voice_enabled: boolean;
            /** @description Fleet MOTD in CCP flavoured HTML */
            motd: string;
        };
        FleetsFleetIdMembersGet: {
            /** Format: int64 */
            character_id: number;
            /** Format: date-time */
            join_time: string;
            /**
             * @description Member’s role in fleet
             * @enum {string}
             */
            role: "fleet_commander" | "wing_commander" | "squad_commander" | "squad_member";
            /** @description Localized role names */
            role_name: string;
            /** Format: int64 */
            ship_type_id: number;
            /**
             * Format: int64
             * @description Solar system the member is located in
             */
            solar_system_id: number;
            /**
             * Format: int64
             * @description ID of the squad the member is in. If not applicable, will be set to -1
             */
            squad_id: number;
            /**
             * Format: int64
             * @description Station in which the member is docked in, if applicable
             */
            station_id?: number;
            /** @description Whether the member take fleet warps */
            takes_fleet_warp: boolean;
            /**
             * Format: int64
             * @description ID of the wing the member is in. If not applicable, will be set to -1
             */
            wing_id: number;
        }[];
        FleetsFleetIdWingsGet: {
            /** Format: int64 */
            id: number;
            name: string;
            squads: {
                /** Format: int64 */
                id: number;
                name: string;
            }[];
        }[];
        /** @description 201 created object */
        FleetsFleetIdWingsPost: {
            /**
             * Format: int64
             * @description The wing_id of the newly created wing
             */
            wing_id: number;
        };
        /** @description 201 created object */
        FleetsFleetIdWingsWingIdSquadsPost: {
            /**
             * Format: int64
             * @description The squad_id of the newly created squad
             */
            squad_id: number;
        };
        FreelanceJobsDetail: {
            /** @description Job's access and visibility */
            access_and_visibility: components["schemas"]["FreelanceJobsDetailAccessandvisibility"];
            /** @description Job's configuration */
            configuration: components["schemas"]["FreelanceJobsDetailConfiguration"];
            /** @description Job's contribution settings */
            contribution?: components["schemas"]["FreelanceJobsDetailContribution"];
            /** @description Job's details */
            details: components["schemas"]["FreelanceJobsDetailDetails"];
            /** @description Job's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description Job's last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
            /**
             * @description Job's name
             * @example Freelance Job Name
             */
            name: string;
            /** @description Job's progress */
            progress: components["schemas"]["FreelanceJobsDetailProgress"];
            /** @description Job's reward */
            reward?: components["schemas"]["FreelanceJobsDetailReward"];
            /**
             * @description Job's state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Closed" | "Completed" | "Expired" | "Deleted";
        };
        FreelanceJobsDetailAccessandvisibility: {
            /**
             * @description Whether the job is protected by an ACL
             * @example false
             */
            acl_protected: boolean;
            /** @description Solar systems where the job is broadcast */
            broadcast_locations?: components["schemas"]["FreelanceJobsDetailBroadcastlocations"][];
            /** @description Restrictions on who can participate */
            restrictions?: components["schemas"]["FreelanceJobsDetailRestrictions"];
        };
        FreelanceJobsDetailBroadcastlocations: {
            /** @description Solar system ID */
            id: components["schemas"]["SolarSystemID"];
            /**
             * @description Solar system name
             * @example Jita
             */
            name: string;
        };
        FreelanceJobsDetailConfiguration: {
            /**
             * @description Contribution method (see SDE for valid values)
             * @example BoostShield
             */
            method: string;
            /** @description Parameter values (see SDE for parameter definition) */
            parameters: {
                [key: string]: {
                    /** @description Parameter that matches a type */
                    matcher?: components["schemas"]["FreelanceJobsDetailParametermatcher"];
                } | {
                    /** @description Parameter that has one or more selected values */
                    options?: components["schemas"]["FreelanceJobsDetailParameteroptions"];
                } | {
                    /** @description Parameter that can be toggled */
                    boolean?: components["schemas"]["FreelanceJobsDetailParameterboolean"];
                } | {
                    /** @description Parameter for delivering items to a corporation */
                    corporation_item_delivery?: components["schemas"]["FreelanceJobsDetailParametercorporationitemdelivery"];
                };
            };
            /**
             * Format: int64
             * @description Version of parameter definition used
             * @example 1
             */
            version: number;
        };
        FreelanceJobsDetailContribution: {
            /**
             * Format: int64
             * @description Limit on the contribution of the individual participant
             * @example 1000
             */
            contribution_per_participant_limit?: number;
            /**
             * Format: int64
             * @description Maximum number of participants that can commit to this job
             * @example 10000
             */
            max_committed_participants: number;
            /**
             * Format: double
             * @description ISK reward per contribution
             * @example 123.5
             */
            reward_per_contribution?: number;
            /**
             * Format: int64
             * @description Limit on amount of contribution per submission
             * @example 100
             */
            submission_limit?: number;
            /**
             * Format: double
             * @description Multiplier towards progress per contribution
             * @example 1.5
             */
            submission_multiplier?: number;
        };
        FreelanceJobsDetailCreator: {
            /** @description Character that created the job */
            character: components["schemas"]["FreelanceJobsDetailCreatorcharacter"];
            /** @description Corporation that created the job */
            corporation: components["schemas"]["FreelanceJobsDetailCreatorcorporation"];
        };
        FreelanceJobsDetailCreatorcharacter: {
            /** @description Character ID */
            id: components["schemas"]["CharacterID"];
            /**
             * @description Character name
             * @example Creator Name
             */
            name: string;
        };
        FreelanceJobsDetailCreatorcorporation: {
            /** @description Corporation ID */
            id: components["schemas"]["CorporationID"];
            /**
             * @description Corporation name
             * @example Creator Corporation
             */
            name: string;
        };
        FreelanceJobsDetailDetails: {
            /**
             * @description Assigned career path
             * @example Explorer
             * @enum {string}
             */
            career: "Unspecified" | "Explorer" | "Industrialist" | "Enforcer" | "Soldier of Fortune";
            /**
             * Format: date-time
             * @description Moment this freelance job was created
             * @example 2025-11-01T00:00:00Z
             */
            created: string;
            /** @description Creator */
            creator: components["schemas"]["FreelanceJobsDetailCreator"];
            /**
             * @description Description
             * @example Freelance Job Description
             */
            description: string;
            /**
             * Format: date-time
             * @description Moment this freelance job expires
             * @example 2025-11-01T00:01:00Z
             */
            expires?: string;
            /**
             * Format: date-time
             * @description Moment this freelance job transitioned to a non-active state
             * @example 2025-11-01T00:00:00Z
             */
            finished?: string;
        };
        FreelanceJobsDetailFreelancejob: {
            /** @description Job's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description Job's last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
            /**
             * @description Job's name
             * @example Freelance Job Name
             */
            name: string;
            /** @description Job's progress */
            progress: components["schemas"]["FreelanceJobsDetailProgress"];
            /** @description Job's reward */
            reward?: components["schemas"]["FreelanceJobsDetailReward"];
            /**
             * @description Job's state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Closed" | "Completed" | "Expired" | "Deleted";
        };
        FreelanceJobsDetailParameterboolean: {
            /**
             * @description Boolean value
             * @example true
             */
            value: boolean;
        };
        FreelanceJobsDetailParametercorporationitemdelivery: {
            /** @description Location for delivery */
            corporation_office_location: components["schemas"]["FreelanceJobsDetailParametermatcher"];
            /** @description Item(s) to be delivered */
            item_type: components["schemas"]["FreelanceJobsDetailParametermatcher"];
        };
        FreelanceJobsDetailParametermatcher: {
            /** @description Value type(s) and their value(s) */
            values: components["schemas"]["FreelanceJobsDetailParametermatchervalue"][];
        };
        FreelanceJobsDetailParametermatchervalue: {
            /**
             * @description Type of the value(s)
             * @example solarsystem
             */
            value_type: string;
            /**
             * @description Value(s) of this type
             * @example [
             *       "30001401"
             *     ]
             */
            values: string[];
        };
        FreelanceJobsDetailParameteroptions: {
            /**
             * @description Selected value(s)
             * @example [
             *       "self",
             *       "corporation"
             *     ]
             */
            selected: string[];
        };
        FreelanceJobsDetailProgress: {
            /**
             * Format: int64
             * @description Current progress
             * @example 50
             */
            current: number;
            /**
             * Format: int64
             * @description Desired progress
             * @example 100
             */
            desired: number;
        };
        FreelanceJobsDetailRestrictions: {
            /**
             * Format: int64
             * @description Maximum age of the participant, in days
             * @example 100
             */
            maximum_age?: number;
            /**
             * Format: int64
             * @description Minimum age of the participant, in days
             * @example 10
             */
            minimum_age?: number;
        };
        FreelanceJobsDetailReward: {
            /**
             * Format: double
             * @description Original amount of ISK that was reserved for this freelance job
             * @example 12345.5
             */
            initial: number;
            /**
             * Format: double
             * @description Remaining ISK to be awarded
             * @example 5432.1
             */
            remaining: number;
        };
        FreelanceJobsListing: {
            cursor?: components["schemas"]["Cursor"];
            /** @description List of freelance jobs */
            freelance_jobs: components["schemas"]["FreelanceJobsDetailFreelancejob"][];
        };
        FwLeaderboardsCharactersGet: {
            /** @description Top 100 rankings of pilots by number of kills from yesterday, last week and in total */
            kills: {
                /** @description Top 100 ranking of pilots active in faction warfare by total kills. A pilot is considered "active" if they have participated in faction warfare in the past 14 days */
                active_total: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    character_id?: number;
                }[];
                /** @description Top 100 ranking of pilots by kills in the past week */
                last_week: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    character_id?: number;
                }[];
                /** @description Top 100 ranking of pilots by kills in the past day */
                yesterday: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    character_id?: number;
                }[];
            };
            /** @description Top 100 rankings of pilots by victory points from yesterday, last week and in total */
            victory_points: {
                /** @description Top 100 ranking of pilots active in faction warfare by total victory points. A pilot is considered "active" if they have participated in faction warfare in the past 14 days */
                active_total: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    character_id?: number;
                }[];
                /** @description Top 100 ranking of pilots by victory points in the past week */
                last_week: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    character_id?: number;
                }[];
                /** @description Top 100 ranking of pilots by victory points in the past day */
                yesterday: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    character_id?: number;
                }[];
            };
        };
        FwLeaderboardsCorporationsGet: {
            /** @description Top 10 rankings of corporations by number of kills from yesterday, last week and in total */
            kills: {
                /** @description Top 10 ranking of corporations active in faction warfare by total kills. A corporation is considered "active" if they have participated in faction warfare in the past 14 days */
                active_total: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    corporation_id?: number;
                }[];
                /** @description Top 10 ranking of corporations by kills in the past week */
                last_week: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    corporation_id?: number;
                }[];
                /** @description Top 10 ranking of corporations by kills in the past day */
                yesterday: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    corporation_id?: number;
                }[];
            };
            /** @description Top 10 rankings of corporations by victory points from yesterday, last week and in total */
            victory_points: {
                /** @description Top 10 ranking of corporations active in faction warfare by total victory points. A corporation is considered "active" if they have participated in faction warfare in the past 14 days */
                active_total: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    corporation_id?: number;
                }[];
                /** @description Top 10 ranking of corporations by victory points in the past week */
                last_week: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    corporation_id?: number;
                }[];
                /** @description Top 10 ranking of corporations by victory points in the past day */
                yesterday: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    corporation_id?: number;
                }[];
            };
        };
        FwLeaderboardsGet: {
            /** @description Top 4 rankings of factions by number of kills from yesterday, last week and in total */
            kills: {
                /** @description Top 4 ranking of factions active in faction warfare by total kills. A faction is considered "active" if they have participated in faction warfare in the past 14 days */
                active_total: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    faction_id?: number;
                }[];
                /** @description Top 4 ranking of factions by kills in the past week */
                last_week: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    faction_id?: number;
                }[];
                /** @description Top 4 ranking of factions by kills in the past day */
                yesterday: {
                    /**
                     * Format: int64
                     * @description Amount of kills
                     */
                    amount?: number;
                    /** Format: int64 */
                    faction_id?: number;
                }[];
            };
            /** @description Top 4 rankings of factions by victory points from yesterday, last week and in total */
            victory_points: {
                /** @description Top 4 ranking of factions active in faction warfare by total victory points. A faction is considered "active" if they have participated in faction warfare in the past 14 days */
                active_total: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    faction_id?: number;
                }[];
                /** @description Top 4 ranking of factions by victory points in the past week */
                last_week: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    faction_id?: number;
                }[];
                /** @description Top 4 ranking of factions by victory points in the past day */
                yesterday: {
                    /**
                     * Format: int64
                     * @description Amount of victory points
                     */
                    amount?: number;
                    /** Format: int64 */
                    faction_id?: number;
                }[];
            };
        };
        FwStatsGet: {
            /** Format: int64 */
            faction_id: number;
            /** @description Summary of kills against an enemy faction for the given faction */
            kills: {
                /**
                 * Format: int64
                 * @description Last week's total number of kills against enemy factions
                 */
                last_week: number;
                /**
                 * Format: int64
                 * @description Total number of kills against enemy factions since faction warfare began
                 */
                total: number;
                /**
                 * Format: int64
                 * @description Yesterday's total number of kills against enemy factions
                 */
                yesterday: number;
            };
            /**
             * Format: int64
             * @description How many pilots fight for the given faction
             */
            pilots: number;
            /**
             * Format: int64
             * @description The number of solar systems controlled by the given faction
             */
            systems_controlled: number;
            /** @description Summary of victory points gained for the given faction */
            victory_points: {
                /**
                 * Format: int64
                 * @description Last week's victory points gained
                 */
                last_week: number;
                /**
                 * Format: int64
                 * @description Total victory points gained since faction warfare began
                 */
                total: number;
                /**
                 * Format: int64
                 * @description Yesterday's victory points gained
                 */
                yesterday: number;
            };
        }[];
        FwSystemsGet: {
            /** @enum {string} */
            contested: "captured" | "contested" | "uncontested" | "vulnerable";
            /** Format: int64 */
            occupier_faction_id: number;
            /** Format: int64 */
            owner_faction_id: number;
            /** Format: int64 */
            solar_system_id: number;
            /** Format: int64 */
            victory_points: number;
            /** Format: int64 */
            victory_points_threshold: number;
        }[];
        /** @description List of factions at war */
        FwWarsGet: {
            /**
             * Format: int64
             * @description The faction ID of the enemy faction.
             */
            against_id: number;
            /** Format: int64 */
            faction_id: number;
        }[];
        /**
         * Format: int64
         * @example 1559
         */
        GroupID: number;
        IncursionsGet: {
            /**
             * Format: int64
             * @description The constellation id in which this incursion takes place
             */
            constellation_id: number;
            /**
             * Format: int64
             * @description The attacking faction's id
             */
            faction_id: number;
            /** @description Whether the final encounter has boss or not */
            has_boss: boolean;
            /** @description A list of infested solar system ids that are a part of this incursion */
            infested_solar_systems: number[];
            /**
             * Format: double
             * @description Influence of this incursion as a float from 0 to 1
             */
            influence: number;
            /**
             * Format: int64
             * @description Staging solar system for this incursion
             */
            staging_solar_system_id: number;
            /**
             * @description The state of this incursion
             * @enum {string}
             */
            state: "withdrawing" | "mobilizing" | "established";
            /** @description The type of this incursion */
            type: string;
        }[];
        IndustryFacilitiesGet: {
            /**
             * Format: int64
             * @description ID of the facility
             */
            facility_id: number;
            /**
             * Format: int64
             * @description Owner of the facility
             */
            owner_id: number;
            /**
             * Format: int64
             * @description Region ID where the facility is
             */
            region_id: number;
            /**
             * Format: int64
             * @description Solar system ID where the facility is
             */
            solar_system_id: number;
            /**
             * Format: double
             * @description Tax imposed by the facility
             */
            tax?: number;
            /**
             * Format: int64
             * @description Type ID of the facility
             */
            type_id: number;
        }[];
        IndustrySystemsGet: {
            cost_indices: {
                /** @enum {string} */
                activity: "copying" | "duplicating" | "invention" | "manufacturing" | "none" | "reaction" | "researching_material_efficiency" | "researching_technology" | "researching_time_efficiency" | "reverse_engineering";
                /** Format: double */
                cost_index: number;
            }[];
            /** Format: int64 */
            solar_system_id: number;
        }[];
        InsurancePricesGet: {
            /** @description A list of a available insurance levels for this ship type */
            levels: {
                /** Format: double */
                cost: number;
                /** @description Localized insurance level */
                name: string;
                /** Format: double */
                payout: number;
            }[];
            /** Format: int64 */
            type_id: number;
        }[];
        /**
         * Format: int64
         * @example 1000000000001
         */
        ItemID: number;
        KillmailsKillmailIdKillmailHashGet: {
            attackers: {
                /** Format: int64 */
                alliance_id?: number;
                /** Format: int64 */
                character_id?: number;
                /** Format: int64 */
                corporation_id?: number;
                /** Format: int64 */
                damage_done: number;
                /** Format: int64 */
                faction_id?: number;
                /** @description Was the attacker the one to achieve the final blow */
                final_blow: boolean;
                /**
                 * Format: double
                 * @description Security status for the attacker
                 */
                security_status: number;
                /**
                 * Format: int64
                 * @description What ship was the attacker flying
                 */
                ship_type_id?: number;
                /**
                 * Format: int64
                 * @description What weapon was used by the attacker for the kill
                 */
                weapon_type_id?: number;
            }[];
            /**
             * Format: int64
             * @description ID of the killmail
             */
            killmail_id: number;
            /**
             * Format: date-time
             * @description Time that the victim was killed and the killmail generated
             */
            killmail_time: string;
            /**
             * Format: int64
             * @description Moon if the kill took place at one
             */
            moon_id?: number;
            /**
             * Format: int64
             * @description Solar system that the kill took place in
             */
            solar_system_id: number;
            victim: {
                /** Format: int64 */
                alliance_id?: number;
                /** Format: int64 */
                character_id?: number;
                /** Format: int64 */
                corporation_id?: number;
                /**
                 * Format: int64
                 * @description How much total damage was taken by the victim
                 */
                damage_taken: number;
                /** Format: int64 */
                faction_id?: number;
                items?: {
                    /**
                     * Format: int64
                     * @description Flag for the location of the item
                     */
                    flag: number;
                    /** Format: int64 */
                    item_type_id: number;
                    items?: {
                        /** Format: int64 */
                        flag: number;
                        /** Format: int64 */
                        item_type_id: number;
                        /** Format: int64 */
                        quantity_destroyed?: number;
                        /** Format: int64 */
                        quantity_dropped?: number;
                        /** Format: int64 */
                        singleton: number;
                    }[];
                    /**
                     * Format: int64
                     * @description How many of the item were destroyed if any
                     */
                    quantity_destroyed?: number;
                    /**
                     * Format: int64
                     * @description How many of the item were dropped if any
                     */
                    quantity_dropped?: number;
                    /** Format: int64 */
                    singleton: number;
                }[];
                /** @description Coordinates of the victim in Cartesian space relative to the Sun */
                position?: {
                    /** Format: double */
                    x: number;
                    /** Format: double */
                    y: number;
                    /** Format: double */
                    z: number;
                };
                /**
                 * Format: int64
                 * @description The ship that the victim was piloting and was destroyed
                 */
                ship_type_id: number;
            };
            /**
             * Format: int64
             * @description War if the killmail is generated in relation to an official war
             */
            war_id?: number;
        };
        LoyaltyStoresCorporationIdOffersGet: {
            /**
             * Format: int64
             * @description Analysis kredit cost
             */
            ak_cost?: number;
            /** Format: int64 */
            isk_cost: number;
            /** Format: int64 */
            lp_cost: number;
            /** Format: int64 */
            offer_id: number;
            /** Format: int64 */
            quantity: number;
            required_items: {
                /** Format: int64 */
                quantity: number;
                /** Format: int64 */
                type_id: number;
            }[];
            /** Format: int64 */
            type_id: number;
        }[];
        MarketsGroupsGet: number[];
        MarketsGroupsMarketGroupIdGet: {
            description: string;
            /** Format: int64 */
            market_group_id: number;
            name: string;
            /** Format: int64 */
            parent_group_id?: number;
            types: number[];
        };
        MarketsPricesGet: {
            /** Format: double */
            adjusted_price?: number;
            /** Format: double */
            average_price?: number;
            /** Format: int64 */
            type_id: number;
        }[];
        MarketsRegionIdHistoryGet: {
            /** Format: double */
            average: number;
            /**
             * Format: date
             * @description The date of this historical statistic entry
             */
            date: string;
            /** Format: double */
            highest: number;
            /** Format: double */
            lowest: number;
            /**
             * Format: int64
             * @description Total number of orders happened that day
             */
            order_count: number;
            /**
             * Format: int64
             * @description Total
             */
            volume: number;
        }[];
        MarketsRegionIdOrdersGet: {
            /** Format: int64 */
            duration: number;
            is_buy_order: boolean;
            /** Format: date-time */
            issued: string;
            /** Format: int64 */
            location_id: number;
            /** Format: int64 */
            min_volume: number;
            /** Format: int64 */
            order_id: number;
            /** Format: double */
            price: number;
            /** @enum {string} */
            range: "station" | "region" | "solarsystem" | "1" | "2" | "3" | "4" | "5" | "10" | "20" | "30" | "40";
            /**
             * Format: int64
             * @description The solar system this order was placed
             */
            system_id: number;
            /** Format: int64 */
            type_id: number;
            /** Format: int64 */
            volume_remain: number;
            /** Format: int64 */
            volume_total: number;
        }[];
        MarketsRegionIdTypesGet: number[];
        MarketsStructuresStructureIdGet: {
            /** Format: int64 */
            duration: number;
            is_buy_order: boolean;
            /** Format: date-time */
            issued: string;
            /** Format: int64 */
            location_id: number;
            /** Format: int64 */
            min_volume: number;
            /** Format: int64 */
            order_id: number;
            /** Format: double */
            price: number;
            /** @enum {string} */
            range: "station" | "region" | "solarsystem" | "1" | "2" | "3" | "4" | "5" | "10" | "20" | "30" | "40";
            /** Format: int64 */
            type_id: number;
            /** Format: int64 */
            volume_remain: number;
            /** Format: int64 */
            volume_total: number;
        }[];
        MetaChangelog: {
            /** @description Per date, list changes for that date */
            changelog: {
                [key: string]: components["schemas"]["MetaChangelogEntry"][];
            };
        };
        MetaChangelogEntry: {
            /** @description Compatibility date of the route */
            compatibility_date: components["schemas"]["CompatibilityDate"];
            /**
             * @description Description
             * @example Updated response schema.
             */
            description: string;
            /**
             * @description HTTP method of the route
             * @example GET
             * @enum {string}
             */
            method: "GET" | "POST" | "PUT" | "DELETE";
            /**
             * @description Path of the route
             * @example /meta/changelog
             */
            path: string;
            /**
             * @description Type of the change
             * @example breaking
             * @enum {string}
             */
            type: "breaking" | "changed" | "new" | "removed";
        };
        MetaCompatibilityDates: {
            /** @description List of compatibility dates. */
            compatibility_dates: components["schemas"]["CompatibilityDate"][];
        };
        MetaName: {
            /**
             * @description The name ESI is going by today. It was almost certainly something else last time you looked.
             * @example EVE Spring Inebriation (ESI)
             */
            current: string;
            /** @description Every name ESI has ever gone by, newest first. It has never once been the same twice. */
            history: components["schemas"]["MetaNameEntry"][];
        };
        MetaNameEntry: {
            /**
             * @description The date ESI started insisting on this name (UTC-11).
             * @example 2026-04-01
             */
            date: string;
            /**
             * @description What those three letters allegedly stood for at the time.
             * @example EVE Spring Inebriation (ESI)
             */
            name: string;
        };
        MetaStatus: {
            /** @description List of all API routes and their health status */
            routes: components["schemas"]["MetaStatusRoutestatus"][];
        };
        MetaStatusRoutestatus: {
            /**
             * @description Route's HTTP method
             * @enum {string}
             */
            method: "GET" | "POST" | "PUT" | "DELETE";
            /** @description Route's HTTP path */
            path: string;
            /**
             * @description Route's health status
             * @enum {string}
             */
            status: "Unknown" | "OK" | "Degraded" | "Down" | "Recovering";
        };
        MilitaryCampaignsDetail: {
            /**
             * Format: date-time
             * @description Moment the campaign transitioned to a non-active state
             * @example 2025-11-01T00:00:00Z
             */
            finished?: string;
            /** @description Campaign's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: int64
             * @description Campaign's progress
             * @example 50
             */
            progress: number;
            /**
             * Format: date-time
             * @description Moment the campaign started
             * @example 2025-11-01T00:00:00Z
             */
            started?: string;
            /**
             * @description Campaign's state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Completed" | "Expired";
        };
        MilitaryCampaignsDetailCampaign: {
            /**
             * Format: date-time
             * @description Moment the campaign transitioned to a non-active state
             * @example 2025-11-01T00:00:00Z
             */
            finished?: string;
            /** @description Campaign's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: int64
             * @description Campaign's progress
             * @example 50
             */
            progress: number;
            /**
             * Format: date-time
             * @description Moment the campaign started
             * @example 2025-11-01T00:00:00Z
             */
            started?: string;
            /**
             * @description Campaign's state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Completed" | "Expired";
        };
        MilitaryCampaignsListing: {
            /** @description List of military campaigns */
            campaigns: components["schemas"]["MilitaryCampaignsDetailCampaign"][];
        };
        MilitaryCampaignsObjectivesDetail: {
            /**
             * Format: date-time
             * @description Moment the objective transitioned to a non-active state
             * @example 2025-11-01T00:00:00Z
             */
            finished?: string;
            /** @description Objective's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description Objective's last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
            /** @description Objective's participants */
            participants: components["schemas"]["MilitaryCampaignsObjectivesDetailParticipants"];
            /**
             * Format: int64
             * @description Objective's progress
             * @example 50
             */
            progress: number;
            /**
             * Format: date-time
             * @description Moment the objective started
             * @example 2025-11-01T00:00:00Z
             */
            started?: string;
            /**
             * @description Objective's state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Completed" | "Expired";
        };
        MilitaryCampaignsObjectivesDetailObjective: {
            /**
             * Format: date-time
             * @description Moment the objective transitioned to a non-active state
             * @example 2025-11-01T00:00:00Z
             */
            finished?: string;
            /** @description Objective's ID */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description Objective's last modified
             * @example 2025-11-01T00:00:00Z
             */
            last_modified: string;
            /** @description Objective's participants */
            participants: components["schemas"]["MilitaryCampaignsObjectivesDetailParticipants"];
            /**
             * Format: int64
             * @description Objective's progress
             * @example 50
             */
            progress: number;
            /**
             * Format: date-time
             * @description Moment the objective started
             * @example 2025-11-01T00:00:00Z
             */
            started?: string;
            /**
             * @description Objective's state
             * @example Active
             * @enum {string}
             */
            state: "Unspecified" | "Active" | "Completed" | "Expired";
        };
        MilitaryCampaignsObjectivesDetailParticipants: {
            /**
             * Format: int64
             * @description Number of currently committed participants
             * @example 1
             */
            committed: number;
            /**
             * Format: int64
             * @description Number of participants with at least one contribution
             * @example 2
             */
            contributors: number;
            /**
             * Format: int64
             * @description Number of participants (including those that resigned)
             * @example 4
             */
            total: number;
        };
        MilitaryCampaignsObjectivesListing: {
            cursor?: components["schemas"]["Cursor"];
            /** @description List of military campaign objectives */
            objectives: components["schemas"]["MilitaryCampaignsObjectivesDetailObjective"][];
        };
        ParagonHubSkinr: {
            cursor?: components["schemas"]["Cursor"];
            /** @description Page of public SKINR listings */
            listings: components["schemas"]["ParagonHubSkinrInternalItem"][];
        };
        ParagonHubSkinrAlliances: {
            cursor?: components["schemas"]["Cursor"];
            /** @description Page of SKINR listings targeted at the alliance */
            listings: components["schemas"]["ParagonHubSkinrInternalItem"][];
        };
        ParagonHubSkinrCharacters: {
            cursor?: components["schemas"]["Cursor"];
            /** @description Page of SKINR listings targeted at the character */
            listings: components["schemas"]["ParagonHubSkinrInternalItem"][];
        };
        ParagonHubSkinrCorporations: {
            cursor?: components["schemas"]["Cursor"];
            /** @description Page of SKINR listings targeted at the corporation */
            listings: components["schemas"]["ParagonHubSkinrInternalItem"][];
        };
        ParagonHubSkinrInternalItem: {
            /**
             * Format: date-time
             * @description When the listing was created
             */
            created: string;
            /**
             * Format: date-time
             * @description When the listing expires
             */
            expires: string;
            /** @description Unique identifier of the listing */
            id: components["schemas"]["UUID"];
            /**
             * Format: date-time
             * @description When this listing was last retrieved from the game
             */
            last_modified: string;
            /** @description Asking price of the listing */
            price: {
                /**
                 * Format: double
                 * @description Price in ISK
                 */
                isk?: number;
            } | {
                /**
                 * Format: int64
                 * @description Price in PLEX
                 */
                plex?: number;
            };
            /**
             * Format: int64
             * @description How many licenses remain in this listing
             * @example 3
             */
            quantity: number;
            /** @description Character that posted the listing */
            seller_id: components["schemas"]["CharacterID"];
            /** @description SKINR license identifier */
            skinr_id: string;
            /**
             * @description Lifecycle state of the listing
             * @enum {string}
             */
            state: "listed" | "sold_out" | "expired" | "removed";
        };
        /**
         * Format: int64
         * @example 40000002
         */
        PlanetID: number;
        /**
         * Format: int64
         * @example 1
         */
        RaceID: number;
        /**
         * Format: int64
         * @example 10000001
         */
        RegionID: number;
        Route: {
            /** @description The route between the origin and destination systems */
            route: components["schemas"]["SolarSystemID"][];
        };
        RouteConnection: {
            /** @description From which system */
            from: components["schemas"]["SolarSystemID"];
            /** @description To which system */
            to: components["schemas"]["SolarSystemID"];
        };
        RouteRequestBody: {
            /** @description Systems to avoid */
            avoid_systems?: components["schemas"]["SolarSystemID"][];
            /** @description Additional one-way connections (like Jump Bridges) between systems */
            connections?: components["schemas"]["RouteConnection"][];
            /**
             * @description Preference for the route
             * @default Shorter
             * @enum {string}
             */
            preference: "Shorter" | "Safer" | "LessSecure";
            /**
             * Format: int64
             * @description Strictness of the path preference
             * @default 50
             */
            security_penalty: number;
        };
        /**
         * Format: int64
         * @description Ship tree group identifier.
         * @example 1559
         */
        ShipTreeGroupID: number;
        SkyhooksRaidable: {
            /** @description List of (upcoming) raidable Skyhooks */
            skyhooks: components["schemas"]["SkyhooksRaidableVulnerableskyhook"][];
        };
        SkyhooksRaidableTheftvulnerability: {
            /**
             * Format: date-time
             * @description End time of the theft vulnerability window
             * @example 2026-02-23T16:00:00Z
             */
            end: string;
            /**
             * Format: date-time
             * @description Start time of the theft vulnerability window
             * @example 2026-02-23T12:00:00Z
             */
            start: string;
        };
        SkyhooksRaidableVulnerableskyhook: {
            /** @description ID of the planet the Skyhook is anchored on */
            planet_id: components["schemas"]["PlanetID"];
            /** @description ID of the solar system the Skyhook is anchored on */
            solar_system_id: components["schemas"]["SolarSystemID"];
            /** @description Skyhook's theft vulnerability */
            theft_vulnerability: components["schemas"]["SkyhooksRaidableTheftvulnerability"];
        };
        /**
         * Format: int64
         * @example 30000001
         */
        SolarSystemID: number;
        SovereigntyCampaignsGet: {
            /**
             * Format: double
             * @description Score for all attacking parties, only present in Defense Events.
             */
            attackers_score?: number;
            /**
             * Format: int64
             * @description Unique ID for this campaign.
             */
            campaign_id: number;
            /**
             * Format: int64
             * @description The constellation in which the campaign will take place.
             */
            constellation_id: number;
            /**
             * Format: int64
             * @description Defending alliance, only present in Defense Events
             */
            defender_id?: number;
            /**
             * Format: double
             * @description Score for the defending alliance, only present in Defense Events.
             */
            defender_score?: number;
            /**
             * @description Type of event this campaign is for. tcu_defense, ihub_defense and station_defense are referred to as "Defense Events", station_freeport as "Freeport Events".
             * @enum {string}
             */
            event_type: "tcu_defense" | "ihub_defense" | "station_defense" | "station_freeport";
            /** @description Alliance participating and their respective scores, only present in Freeport Events. */
            participants?: {
                /** Format: int64 */
                alliance_id: number;
                /** Format: double */
                score: number;
            }[];
            /**
             * Format: int64
             * @description The solar system the structure is located in.
             */
            solar_system_id: number;
            /**
             * Format: date-time
             * @description Time the event is scheduled to start.
             */
            start_time: string;
            /**
             * Format: int64
             * @description The structure item ID that is related to this campaign.
             */
            structure_id: number;
        }[];
        SovereigntySystems: {
            /** @description List of solar systems and their sovereignty owners */
            solar_systems: components["schemas"]["SovereigntySystemsSolarsystem"][];
        };
        SovereigntySystemsAlliance: {
            /** @description Alliance that claimed this solar system */
            alliance_id: components["schemas"]["AllianceID"];
            /**
             * Format: date-time
             * @description Time the claim was made
             * @example 2026-02-23T12:00:00Z
             */
            claimed_since: string;
            /** @description Corporation that claimed this solar system */
            corporation_id: components["schemas"]["CorporationID"];
            /** @description Solar system's development */
            development: components["schemas"]["SovereigntySystemsDevelopment"];
            /**
             * @description Whether the system is the capital system of the alliance
             * @example false
             */
            is_capital_system: boolean;
            /** @description Sovereignty Hub holding the claim */
            sovereignty_hub: components["schemas"]["SovereigntySystemsSovereigntyhub"];
        };
        SovereigntySystemsDevelopment: {
            /**
             * Format: double
             * @description Current Activity Defense Multiplier
             * @example 1.2
             */
            activity_defense_multiplier: number;
            /**
             * Format: int64
             * @description Industrial level (0-5) of this solar system
             * @example 0
             */
            industrial_level: number;
            /**
             * Format: int64
             * @description Military level (0-5) of this solar system
             * @example 3
             */
            military_level: number;
            /**
             * Format: int64
             * @description Strategic level (0-5) of this solar system
             * @example 5
             */
            strategic_level: number;
        };
        SovereigntySystemsFaction: {
            /** @description Faction that claimed this solar system */
            faction_id: components["schemas"]["FactionID"];
        };
        SovereigntySystemsSolarsystem: {
            /** @description Claim on this solar system */
            claim: {
                /** @description Solar system is claimed by a faction */
                faction?: components["schemas"]["SovereigntySystemsFaction"];
            } | {
                /** @description Solar system is claimed by an alliance */
                alliance?: components["schemas"]["SovereigntySystemsAlliance"];
            } | {
                /** @description Solar system is unclaimed */
                unclaimed?: boolean;
            };
            /** @description ID of the solar system */
            solar_system_id: components["schemas"]["SolarSystemID"];
        };
        SovereigntySystemsSovereigntyhub: {
            /** @description ID of the Sovereignty Hub */
            id: components["schemas"]["ItemID"];
            /** @description Sovereignty Hub's vulnerability window; if omitted, this Sovereignty Hub is part of an active campaign */
            vulnerability_window?: components["schemas"]["SovereigntySystemsVulnerabilitywindow"];
        };
        SovereigntySystemsVulnerabilitywindow: {
            /**
             * Format: date-time
             * @description End time of the vulnerability window; if in the past, the Sovereignty Hub is in overtime
             * @example 2026-02-23T16:00:00Z
             */
            end: string;
            /**
             * Format: date-time
             * @description Start time of the vulnerability window; if in the past, the Sovereignty Hub is vulnerable right now
             * @example 2026-02-23T12:00:00Z
             */
            start: string;
        };
        /**
         * Format: int64
         * @example 60000001
         */
        StationID: number;
        Status: {
            /**
             * Format: int64
             * @description Number of characters currently logged in
             * @example 12345
             */
            players: number;
            /**
             * @description Build number of the cluster
             * @example 1132976
             */
            server_version: string;
            /**
             * Format: date-time
             * @description Moment the cluster started accepting connections
             * @example 2017-01-02T12:34:56Z
             */
            start_time: string;
            /** @description Whether the cluster only accepts VIP logins */
            vip: boolean;
        };
        /**
         * Format: int64
         * @example 587
         */
        TypeID: number;
        /**
         * Format: uuid
         * @example 3868eaed-8278-4cb7-9709-7d7de9c20dc7
         */
        UUID: string;
        UniverseAncestriesGet: {
            /**
             * Format: int64
             * @description The bloodline associated with this ancestry
             */
            bloodline_id: number;
            description: string;
            /** Format: int64 */
            icon_id?: number;
            /** Format: int64 */
            id: number;
            name: string;
            short_description?: string;
        }[];
        UniverseAsteroidBeltsAsteroidBeltIdGet: {
            name: string;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /**
             * Format: int64
             * @description The solar system this asteroid belt is in
             */
            system_id: number;
        };
        UniverseBloodlinesGet: {
            /** Format: int64 */
            bloodline_id: number;
            /** Format: int64 */
            charisma: number;
            /** Format: int64 */
            corporation_id: number;
            description: string;
            /** Format: int64 */
            intelligence: number;
            /** Format: int64 */
            memory: number;
            name: string;
            /** Format: int64 */
            perception: number;
            /** Format: int64 */
            race_id: number;
            /** Format: int64 */
            ship_type_id: number;
            /** Format: int64 */
            willpower: number;
        }[];
        UniverseCategoriesCategoryIdGet: {
            /** Format: int64 */
            category_id: number;
            groups: number[];
            name: string;
            published: boolean;
        };
        UniverseCategoriesGet: number[];
        UniverseConstellationsConstellationIdGet: {
            /** Format: int64 */
            constellation_id: number;
            name: string;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /**
             * Format: int64
             * @description The region this constellation is in
             */
            region_id: number;
            systems: number[];
        };
        UniverseConstellationsGet: number[];
        UniverseFactionsGet: {
            /** Format: int64 */
            corporation_id?: number;
            description: string;
            /** Format: int64 */
            faction_id: number;
            is_unique: boolean;
            /** Format: int64 */
            militia_corporation_id?: number;
            name: string;
            /** Format: double */
            size_factor: number;
            /** Format: int64 */
            solar_system_id?: number;
            /** Format: int64 */
            station_count: number;
            /** Format: int64 */
            station_system_count: number;
        }[];
        UniverseGraphicsGet: number[];
        UniverseGraphicsGraphicIdGet: {
            collision_file?: string;
            graphic_file?: string;
            /** Format: int64 */
            graphic_id: number;
            icon_folder?: string;
            sof_dna?: string;
            sof_fation_name?: string;
            sof_hull_name?: string;
            sof_race_name?: string;
        };
        UniverseGroupsGet: number[];
        UniverseGroupsGroupIdGet: {
            /** Format: int64 */
            category_id: number;
            /** Format: int64 */
            group_id: number;
            name: string;
            published: boolean;
            types: number[];
        };
        UniverseIdsPost: {
            agents?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            alliances?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            characters?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            constellations?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            corporations?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            factions?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            inventory_types?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            regions?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            stations?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
            systems?: {
                /** Format: int64 */
                id?: number;
                name?: string;
            }[];
        };
        UniverseMoonsMoonIdGet: {
            /** Format: int64 */
            moon_id: number;
            name: string;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /**
             * Format: int64
             * @description The solar system this moon is in
             */
            system_id: number;
        };
        UniverseNamesPost: {
            /** @enum {string} */
            category: "alliance" | "character" | "constellation" | "corporation" | "inventory_type" | "region" | "solar_system" | "station" | "faction";
            /** Format: int64 */
            id: number;
            name: string;
        }[];
        UniversePlanetsPlanetIdGet: {
            name: string;
            /** Format: int64 */
            planet_id: number;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /**
             * Format: int64
             * @description The solar system this planet is in
             */
            system_id: number;
            /** Format: int64 */
            type_id: number;
        };
        UniverseRacesGet: {
            /**
             * Format: int64
             * @description The alliance generally associated with this race
             */
            alliance_id: number;
            description: string;
            name: string;
            /** Format: int64 */
            race_id: number;
        }[];
        UniverseRegionsGet: number[];
        UniverseRegionsRegionIdGet: {
            constellations: number[];
            description?: string;
            name: string;
            /** Format: int64 */
            region_id: number;
        };
        UniverseSchematicsSchematicIdGet: {
            /**
             * Format: int64
             * @description Time in seconds to process a run
             */
            cycle_time: number;
            schematic_name: string;
        };
        UniverseStargatesStargateIdGet: {
            destination: {
                /**
                 * Format: int64
                 * @description The stargate this stargate connects to
                 */
                stargate_id: number;
                /**
                 * Format: int64
                 * @description The solar system this stargate connects to
                 */
                system_id: number;
            };
            name: string;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /** Format: int64 */
            stargate_id: number;
            /**
             * Format: int64
             * @description The solar system this stargate is in
             */
            system_id: number;
            /** Format: int64 */
            type_id: number;
        };
        UniverseStarsStarIdGet: {
            /**
             * Format: int64
             * @description Age of star in years
             */
            age: number;
            /** Format: double */
            luminosity: number;
            name: string;
            /** Format: int64 */
            radius: number;
            /** Format: int64 */
            solar_system_id: number;
            /** @enum {string} */
            spectral_class: "K2 V" | "K4 V" | "G2 V" | "G8 V" | "M7 V" | "K7 V" | "M2 V" | "K5 V" | "M3 V" | "G0 V" | "G7 V" | "G3 V" | "F9 V" | "G5 V" | "F6 V" | "K8 V" | "K9 V" | "K6 V" | "G9 V" | "G6 V" | "G4 VI" | "G4 V" | "F8 V" | "F2 V" | "F1 V" | "K3 V" | "F0 VI" | "G1 VI" | "G0 VI" | "K1 V" | "M4 V" | "M1 V" | "M6 V" | "M0 V" | "K2 IV" | "G2 VI" | "K0 V" | "K5 IV" | "F5 VI" | "G6 VI" | "F6 VI" | "F2 IV" | "G3 VI" | "M8 V" | "F1 VI" | "K1 IV" | "F7 V" | "G5 VI" | "M5 V" | "G7 VI" | "F5 V" | "F4 VI" | "F8 VI" | "K3 IV" | "F4 IV" | "F0 V" | "G7 IV" | "G8 VI" | "F2 VI" | "F4 V" | "F7 VI" | "F3 V" | "G1 V" | "G9 VI" | "F3 IV" | "F9 VI" | "M9 V" | "K0 IV" | "F1 IV" | "G4 IV" | "F3 VI" | "K4 IV" | "G5 IV" | "G3 IV" | "G1 IV" | "K7 IV" | "G0 IV" | "K6 IV" | "K9 IV" | "G2 IV" | "F9 IV" | "F0 IV" | "K8 IV" | "G8 IV" | "F6 IV" | "F5 IV" | "A0" | "A0IV" | "A0IV2";
            /** Format: int64 */
            temperature: number;
            /** Format: int64 */
            type_id: number;
        };
        UniverseStationsStationIdGet: {
            /** Format: double */
            max_dockable_ship_volume: number;
            name: string;
            /** Format: double */
            office_rental_cost: number;
            /**
             * Format: int64
             * @description ID of the corporation that controls this station
             */
            owner?: number;
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /** Format: int64 */
            race_id?: number;
            /** Format: double */
            reprocessing_efficiency: number;
            /** Format: double */
            reprocessing_stations_take: number;
            services: ("bounty-missions" | "assasination-missions" | "courier-missions" | "interbus" | "reprocessing-plant" | "refinery" | "market" | "black-market" | "stock-exchange" | "cloning" | "surgery" | "dna-therapy" | "repair-facilities" | "factory" | "labratory" | "gambling" | "fitting" | "paintshop" | "news" | "storage" | "insurance" | "docking" | "office-rental" | "jump-clone-facility" | "loyalty-point-store" | "navy-offices" | "security-offices")[];
            /** Format: int64 */
            station_id: number;
            /**
             * Format: int64
             * @description The solar system this station is in
             */
            system_id: number;
            /** Format: int64 */
            type_id: number;
        };
        UniverseStructuresGet: number[];
        UniverseStructuresStructureIdGet: {
            /** @description The full name of the structure */
            name: string;
            /**
             * Format: int64
             * @description The ID of the corporation who owns this particular structure
             */
            owner_id: number;
            /** @description Coordinates of the structure in Cartesian space relative to the Sun, in metres. */
            position?: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            /** Format: int64 */
            solar_system_id: number;
            /** Format: int64 */
            type_id?: number;
        };
        UniverseSystemJumpsGet: {
            /** Format: int64 */
            ship_jumps: number;
            /** Format: int64 */
            system_id: number;
        }[];
        UniverseSystemKillsGet: {
            /**
             * Format: int64
             * @description Number of NPC ships killed in this system
             */
            npc_kills: number;
            /**
             * Format: int64
             * @description Number of pods killed in this system
             */
            pod_kills: number;
            /**
             * Format: int64
             * @description Number of player ships killed in this system
             */
            ship_kills: number;
            /** Format: int64 */
            system_id: number;
        }[];
        UniverseSystemsGet: number[];
        UniverseSystemsSystemIdGet: {
            /**
             * Format: int64
             * @description The constellation this solar system is in
             */
            constellation_id: number;
            name: string;
            planets?: {
                asteroid_belts?: number[];
                moons?: number[];
                /** Format: int64 */
                planet_id: number;
            }[];
            position: {
                /** Format: double */
                x: number;
                /** Format: double */
                y: number;
                /** Format: double */
                z: number;
            };
            security_class?: string;
            /** Format: double */
            security_status: number;
            /** Format: int64 */
            star_id?: number;
            stargates?: number[];
            stations?: number[];
            /** Format: int64 */
            system_id: number;
        };
        UniverseTypesGet: number[];
        UniverseTypesTypeIdGet: {
            /** Format: double */
            capacity?: number;
            description: string;
            dogma_attributes?: {
                /** Format: int64 */
                attribute_id: number;
                /** Format: double */
                value: number;
            }[];
            dogma_effects?: {
                /** Format: int64 */
                effect_id: number;
                is_default: boolean;
            }[];
            /** Format: int64 */
            graphic_id?: number;
            /** Format: int64 */
            group_id: number;
            /** Format: int64 */
            icon_id?: number;
            /**
             * Format: int64
             * @description This only exists for types that can be put on the market
             */
            market_group_id?: number;
            /** Format: double */
            mass?: number;
            name: string;
            /** Format: double */
            packaged_volume?: number;
            /** Format: int64 */
            portion_size?: number;
            published: boolean;
            /** Format: double */
            radius?: number;
            /** Format: int64 */
            type_id: number;
            /** Format: double */
            volume?: number;
        };
        WarsGet: number[];
        WarsWarIdGet: {
            /** @description The aggressor corporation or alliance that declared this war, only contains either corporation_id or alliance_id */
            aggressor: {
                /**
                 * Format: int64
                 * @description Alliance ID if and only if the aggressor is an alliance
                 */
                alliance_id?: number;
                /**
                 * Format: int64
                 * @description Corporation ID if and only if the aggressor is a corporation
                 */
                corporation_id?: number;
                /**
                 * Format: double
                 * @description ISK value of ships the aggressor has destroyed
                 */
                isk_destroyed: number;
                /**
                 * Format: int64
                 * @description The number of ships the aggressor has killed
                 */
                ships_killed: number;
            };
            /** @description allied corporations or alliances, each object contains either corporation_id or alliance_id */
            allies?: {
                /**
                 * Format: int64
                 * @description Alliance ID if and only if this ally is an alliance
                 */
                alliance_id?: number;
                /**
                 * Format: int64
                 * @description Corporation ID if and only if this ally is a corporation
                 */
                corporation_id?: number;
            }[];
            /**
             * Format: date-time
             * @description Time that the war was declared
             */
            declared: string;
            /** @description The defending corporation or alliance that declared this war, only contains either corporation_id or alliance_id */
            defender: {
                /**
                 * Format: int64
                 * @description Alliance ID if and only if the defender is an alliance
                 */
                alliance_id?: number;
                /**
                 * Format: int64
                 * @description Corporation ID if and only if the defender is a corporation
                 */
                corporation_id?: number;
                /**
                 * Format: double
                 * @description ISK value of ships the defender has killed
                 */
                isk_destroyed: number;
                /**
                 * Format: int64
                 * @description The number of ships the defender has killed
                 */
                ships_killed: number;
            };
            /**
             * Format: date-time
             * @description Time the war ended and shooting was no longer allowed
             */
            finished?: string;
            /**
             * Format: int64
             * @description ID of the specified war
             */
            id: number;
            /** @description Was the war declared mutual by both parties */
            mutual: boolean;
            /** @description Is the war currently open for allies or not */
            open_for_allies: boolean;
            /**
             * Format: date-time
             * @description Time the war was retracted but both sides could still shoot each other
             */
            retracted?: string;
            /**
             * Format: date-time
             * @description Time when the war started and both sides could shoot each other
             */
            started?: string;
        };
        WarsWarIdKillmailsGet: {
            /** @description A hash of this killmail */
            killmail_hash: string;
            /**
             * Format: int64
             * @description ID of this killmail
             */
            killmail_id: number;
        }[];
    };
    responses: never;
    parameters: {
        /** @description The language to use for the response. */
        AcceptLanguage: "en" | "de" | "fr" | "ja" | "ru" | "zh" | "ko" | "es";
        /** @description The compatibility date for the request. */
        CompatibilityDate: "2026-08-18";
        /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
        IfModifiedSince: string;
        /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
        IfNoneMatch: string;
        /**
         * @description The tenant ID for the request.
         * @example
         */
        Tenant: string;
    };
    requestBodies: never;
    headers: {
        /** @description Directives for caching mechanisms. It controls how the response can be cached, by whom, and for how long. */
        CacheControl: string;
        /** @description The language used in the response. */
        ContentLanguage: "en" | "de" | "fr" | "ja" | "ru" | "zh" | "ko" | "es";
        /** @description The ETag value of the response body. Use this with If-None-Match to check whether the resource has changed. */
        ETag: string;
        /** @description The last modified date of the response. Use this with If-Modified-Since to check whether the resource has changed. */
        LastModified: string;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    GetAlliances: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlliancesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetAlliancesAllianceId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the alliance */
                alliance_id: components["schemas"]["AllianceID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AllianceDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetAlliancesAllianceIdContacts: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the alliance */
                alliance_id: components["schemas"]["AllianceID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlliancesAllianceIdContactsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetAlliancesAllianceIdContactsLabels: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the alliance */
                alliance_id: components["schemas"]["AllianceID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlliancesAllianceIdContactsLabelsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetAlliancesAllianceIdCorporations: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the alliance */
                alliance_id: components["schemas"]["AllianceID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlliancesAllianceIdCorporationsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetAlliancesAllianceIdIcons: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the alliance */
                alliance_id: components["schemas"]["AllianceID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AlliancesAllianceIdIconsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersAffiliation: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersAffiliationPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersAccessListsListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersAccessListsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersAccessListsDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the Access List */
                access_list_id: components["schemas"]["AccessListID"];
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersAccessListsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdAgentsResearch: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdAgentsResearchGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdAssets: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdAssetsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdAssetsLocations: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdAssetsLocationsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdAssetsNames: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdAssetsNamesPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdAttributes: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdAttributesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdBlueprints: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdBlueprintsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdCalendar: {
        parameters: {
            query?: {
                from_event?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdCalendarGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdCalendarEventId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdCalendarEventIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutCharactersCharacterIdCalendarEventId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                event_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @enum {string} */
                    response: "accepted" | "declined" | "tentative";
                };
            };
        };
        responses: {
            /** @description Event updated */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdCalendarEventIdAttendees: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                event_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdCalendarEventIdAttendeesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdClones: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdClonesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdContacts: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdContactsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutCharactersCharacterIdContacts: {
        parameters: {
            query: {
                label_ids?: number[];
                standing: number;
                watched?: boolean;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description Contacts updated */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdContacts: {
        parameters: {
            query: {
                label_ids?: number[];
                standing: number;
                watched?: boolean;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdContactsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteCharactersCharacterIdContacts: {
        parameters: {
            query: {
                contact_ids: number[];
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Contacts deleted */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdContactsLabels: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdContactsLabelsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdContracts: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdContractsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdContractsContractIdBids: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                contract_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdContractsContractIdBidsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdContractsContractIdItems: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                contract_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdContractsContractIdItemsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdCorporationhistory: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdCorporationhistoryGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCosmeticsSkinr: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character whose SKINR licenses to return */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCosmeticsSkinr"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCosmeticsSkinrComponents: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character whose SKINR component licenses to return */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCosmeticsSkinrComponents"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdCspa: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdCspaPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdFatigue: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdFatigueGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdFittings: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdFittingsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdFittings: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    description: string;
                    items: {
                        /**
                         * @description Fitting location for the item. Entries placed in 'Invalid' will be discarded. If this leaves the fitting with nothing, it will cause an error.
                         * @enum {string}
                         */
                        flag: "Cargo" | "DroneBay" | "FighterBay" | "HiSlot0" | "HiSlot1" | "HiSlot2" | "HiSlot3" | "HiSlot4" | "HiSlot5" | "HiSlot6" | "HiSlot7" | "Invalid" | "LoSlot0" | "LoSlot1" | "LoSlot2" | "LoSlot3" | "LoSlot4" | "LoSlot5" | "LoSlot6" | "LoSlot7" | "MedSlot0" | "MedSlot1" | "MedSlot2" | "MedSlot3" | "MedSlot4" | "MedSlot5" | "MedSlot6" | "MedSlot7" | "RigSlot0" | "RigSlot1" | "RigSlot2" | "ServiceSlot0" | "ServiceSlot1" | "ServiceSlot2" | "ServiceSlot3" | "ServiceSlot4" | "ServiceSlot5" | "ServiceSlot6" | "ServiceSlot7" | "SubSystemSlot0" | "SubSystemSlot1" | "SubSystemSlot2" | "SubSystemSlot3";
                        /** Format: int64 */
                        quantity: number;
                        /** Format: int64 */
                        type_id: number;
                    }[];
                    name: string;
                    /** Format: int64 */
                    ship_type_id: number;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdFittingsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteCharactersCharacterIdFittingsFittingId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                fitting_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Fitting deleted */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdFleet: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdFleetGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersFreelanceJobsListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersFreelanceJobsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersFreelanceJobsParticipation: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                /** @description The ID of the freelance job */
                job_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersFreelanceJobsParticipation"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdFwStats: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdFwStatsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdImplants: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdImplantsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdIndustryJobs: {
        parameters: {
            query?: {
                include_completed?: boolean;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdIndustryJobsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdKillmailsRecent: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdKillmailsRecentGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdLocation: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersLocation"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdLoyaltyPoints: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdLoyaltyPointsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdMail: {
        parameters: {
            query?: {
                labels?: number[];
                last_mail_id?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMailGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdMail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: int64
                     * @default 0
                     */
                    approved_cost?: number;
                    body: string;
                    recipients: {
                        /** Format: int64 */
                        recipient_id: number;
                        /** @enum {string} */
                        recipient_type: "alliance" | "character" | "corporation" | "mailing_list";
                    }[];
                    subject: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMailPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdMailLabels: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMailLabelsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCharactersCharacterIdMailLabels: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description Hexadecimal string representing label color, in RGB format
                     * @default #ffffff
                     * @enum {string}
                     */
                    color?: "#0000fe" | "#006634" | "#0099ff" | "#00ff33" | "#01ffff" | "#349800" | "#660066" | "#666666" | "#999999" | "#99ffff" | "#9a0000" | "#ccff9a" | "#e6e6e6" | "#fe0000" | "#ff6600" | "#ffff01" | "#ffffcd" | "#ffffff";
                    name: string;
                };
            };
        };
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMailLabelsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteCharactersCharacterIdMailLabelsLabelId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                label_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Label deleted */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdMailLists: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMailListsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdMailMailId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                mail_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMailMailIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutCharactersCharacterIdMailMailId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                mail_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Labels to assign to the mail. Pre-existing labels are unassigned. */
                    labels?: number[];
                    /** @description Whether the mail is flagged as read */
                    read?: boolean;
                };
            };
        };
        responses: {
            /** @description Mail updated */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteCharactersCharacterIdMailMailId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                mail_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Mail deleted */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdMedals: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMedalsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersMercenaryTacticalOperationsListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersMercenaryTacticalOperationsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersMercenaryTacticalOperationsDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the operation */
                operation_id: components["schemas"]["UUID"];
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersMercenaryTacticalOperationsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersMilitaryCampaignsObjectivesListing: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersMilitaryCampaignsObjectivesListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersMilitaryCampaignsObjectivesParticipation: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                /** @description The ID of the objective */
                objective_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersMilitaryCampaignsObjectivesParticipation"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdMining: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdMiningGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdNotifications: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdNotificationsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdNotificationsContacts: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdNotificationsContactsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdOnline: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersOnline"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdOrders: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdOrdersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdOrdersHistory: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdOrdersHistoryGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersParagonHubSkinr: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character whose listings to return */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersParagonHubSkinr"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdPlanets: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdPlanetsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdPlanetsPlanetId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
                planet_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdPlanetsPlanetIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdPortrait: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdPortraitGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdRoles: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdRolesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdSearch: {
        parameters: {
            query: {
                categories: ("agent" | "alliance" | "character" | "constellation" | "corporation" | "faction" | "inventory_type" | "region" | "solar_system" | "station" | "structure")[];
                search: string;
                strict?: boolean;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdSearchGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdShip: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersShip"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdSkillqueue: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersSkillqueueSkill"][];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdSkills: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersSkills"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdStandings: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdStandingsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersStructuresMercenaryDensListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersStructuresMercenaryDensListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersStructuresMercenaryDensDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the Mercenary Den */
                mercenary_den_id: components["schemas"]["ItemID"];
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersStructuresMercenaryDensDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdTitles: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdTitlesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdWallet: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdWalletGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdWalletJournal: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdWalletJournalGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCharactersCharacterIdWalletTransactions: {
        parameters: {
            query?: {
                from_id?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CharactersCharacterIdWalletTransactionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetContractsPublicBidsContractId: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                contract_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractsPublicBidsContractIdGet"];
                };
            };
            /** @description Contract expired or recently accepted by player */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    GetContractsPublicItemsContractId: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                contract_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractsPublicItemsContractIdGet"];
                };
            };
            /** @description Contract expired or recently accepted by player */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": unknown;
                };
            };
        };
    };
    GetContractsPublicRegionId: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                region_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ContractsPublicRegionIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationCorporationIdMiningExtractions: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationCorporationIdMiningExtractionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationCorporationIdMiningObservers: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationCorporationIdMiningObserversGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationCorporationIdMiningObserversObserverId: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                observer_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationCorporationIdMiningObserversObserverIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsNpccorps: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsNpccorpsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdAlliancehistory: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdAlliancehistoryGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdAssets: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdAssetsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCorporationsCorporationIdAssetsLocations: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdAssetsLocationsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostCorporationsCorporationIdAssetsNames: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdAssetsNamesPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdBlueprints: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdBlueprintsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdContacts: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdContactsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdContactsLabels: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdContactsLabelsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdContainersLogs: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdContainersLogsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdContracts: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdContractsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdContractsContractIdBids: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                contract_id: number;
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdContractsContractIdBidsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdContractsContractIdItems: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                contract_id: number;
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdContractsContractIdItemsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdCustomsOffices: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdCustomsOfficesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdDivisions: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdDivisionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdFacilities: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdFacilitiesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsFreelanceJobsListing: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsFreelanceJobsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsFreelanceJobsParticipants: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                /** @description The ID of the job */
                job_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsFreelanceJobsParticipants"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdFwStats: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdFwStatsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdIcons: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdIconsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdIndustryJobs: {
        parameters: {
            query?: {
                include_completed?: boolean;
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdIndustryJobsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdKillmailsRecent: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdKillmailsRecentGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdMedals: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdMedalsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdMedalsIssued: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdMedalsIssuedGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdMembers: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdMembersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdMembersLimit: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdMembersLimitGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdMembersTitles: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdMembersTitlesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdMembertracking: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdMembertrackingGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdOrders: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdOrdersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdOrdersHistory: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdOrdersHistoryGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsProjectsListing: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
                /** @description Filter by state */
                state?: "All" | "Active";
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsProjectsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsProjectsDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                /** @description The ID of the project */
                project_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsProjectsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsProjectsContribution: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                /** @description The ID of the project */
                project_id: components["schemas"]["UUID"];
                /** @description The ID of the character */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsProjectsContribution"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsProjectsContributors: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                /** @description The ID of the project */
                project_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsProjectsContributors"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdRoles: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdRolesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdRolesHistory: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdRolesHistoryGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdShareholders: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdShareholdersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdStandings: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdStandingsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdStarbases: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdStarbasesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdStarbasesStarbaseId: {
        parameters: {
            query: {
                system_id: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                starbase_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdStarbasesStarbaseIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdStructures: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdStructuresGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsStructuresSkyhooksListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsStructuresSkyhooksListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsStructuresSkyhooksDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the Skyhook */
                skyhook_id: components["schemas"]["ItemID"];
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsStructuresSkyhooksDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsStructuresSovereigntyHubsListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsStructuresSovereigntyHubsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsStructuresSovereigntyHubsDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the Sovereignty Hub */
                sovereignty_hub_id: components["schemas"]["ItemID"];
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsStructuresSovereigntyHubsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdTitles: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdTitlesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdWallets: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdWalletsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdWalletsDivisionJournal: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                division: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdWalletsDivisionJournalGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCorporationsCorporationIdWalletsDivisionTransactions: {
        parameters: {
            query?: {
                from_id?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
                division: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CorporationsCorporationIdWalletsDivisionTransactionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetCosmeticsSkinr: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description SKINR identifier */
                skinr_id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CosmeticsSkinr"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetDogmaAttributes: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DogmaAttributesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetDogmaAttributesAttributeId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                attribute_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DogmaAttributesAttributeIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetDogmaDynamicItemsTypeIdItemId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                item_id: number;
                type_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DogmaDynamicItemsTypeIdItemIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetDogmaEffects: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DogmaEffectsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetDogmaEffectsEffectId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                effect_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DogmaEffectsEffectIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFleetsFleetId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FleetsFleetIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutFleetsFleetId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /** @description Should free-move be enabled in the fleet */
                    is_free_move?: boolean;
                    /** @description New fleet MOTD in CCP flavoured HTML */
                    motd?: string;
                };
            };
        };
        responses: {
            /** @description Fleet updated */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFleetsFleetIdMembers: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FleetsFleetIdMembersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostFleetsFleetIdMembers: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * Format: int64
                     * @description The character you want to invite
                     */
                    character_id: number;
                    /**
                     * @description If a character is invited with the `fleet_commander` role, neither `wing_id` or `squad_id` should be specified. If a character is invited with the `wing_commander` role, only `wing_id` should be specified. If a character is invited with the `squad_commander` role, both `wing_id` and `squad_id` should be specified. If a character is invited with the `squad_member` role, `wing_id` and `squad_id` should either both be specified or not specified at all. If they aren’t specified, the invited character will join any squad with available positions.
                     * @enum {string}
                     */
                    role: "fleet_commander" | "wing_commander" | "squad_commander" | "squad_member";
                    /** Format: int64 */
                    squad_id?: number;
                    /** Format: int64 */
                    wing_id?: number;
                };
            };
        };
        responses: {
            /** @description Fleet invitation sent */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutFleetsFleetIdMembersMemberId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                member_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    /**
                     * @description If a character is moved to the `fleet_commander` role, neither `wing_id` or `squad_id` should be specified. If a character is moved to the `wing_commander` role, only `wing_id` should be specified. If a character is moved to the `squad_commander` role, both `wing_id` and `squad_id` should be specified. If a character is moved to the `squad_member` role, both `wing_id` and `squad_id` should be specified.
                     * @enum {string}
                     */
                    role: "fleet_commander" | "wing_commander" | "squad_commander" | "squad_member";
                    /** Format: int64 */
                    squad_id?: number;
                    /** Format: int64 */
                    wing_id?: number;
                };
            };
        };
        responses: {
            /** @description Fleet invitation sent */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteFleetsFleetIdMembersMemberId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                member_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Fleet member kicked */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutFleetsFleetIdSquadsSquadId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                squad_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                };
            };
        };
        responses: {
            /** @description Squad renamed */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteFleetsFleetIdSquadsSquadId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                squad_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Squad deleted */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFleetsFleetIdWings: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FleetsFleetIdWingsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostFleetsFleetIdWings: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FleetsFleetIdWingsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PutFleetsFleetIdWingsWingId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                wing_id: number;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    name: string;
                };
            };
        };
        responses: {
            /** @description Wing renamed */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    DeleteFleetsFleetIdWingsWingId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                wing_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Wing deleted */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostFleetsFleetIdWingsWingIdSquads: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                fleet_id: number;
                wing_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Created */
            201: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FleetsFleetIdWingsWingIdSquadsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFreelanceJobsListing: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
                /** @description Filter on corporation ID */
                corporation_id?: components["schemas"]["CorporationID"];
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FreelanceJobsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFreelanceJobsDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the freelance job */
                job_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FreelanceJobsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFwLeaderboards: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FwLeaderboardsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFwLeaderboardsCharacters: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FwLeaderboardsCharactersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFwLeaderboardsCorporations: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FwLeaderboardsCorporationsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFwStats: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FwStatsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFwSystems: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FwSystemsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetFwWars: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FwWarsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetIncursions: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IncursionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetIndustryFacilities: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IndustryFacilitiesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetIndustrySystems: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IndustrySystemsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetInsurancePrices: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InsurancePricesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetKillmailsKillmailIdKillmailHash: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                killmail_hash: string;
                killmail_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["KillmailsKillmailIdKillmailHashGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetLoyaltyStoresCorporationIdOffers: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoyaltyStoresCorporationIdOffersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsGroups: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsGroupsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsGroupsMarketGroupId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                market_group_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsGroupsMarketGroupIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsPrices: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsPricesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsStructuresStructureId: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                structure_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsStructuresStructureIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsRegionIdHistory: {
        parameters: {
            query: {
                type_id: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                region_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsRegionIdHistoryGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsRegionIdOrders: {
        parameters: {
            query: {
                order_type: "buy" | "sell" | "all";
                page?: number;
                type_id?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                region_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsRegionIdOrdersGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMarketsRegionIdTypes: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                region_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MarketsRegionIdTypesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMetaChangelog: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetaChangelog"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMetaCompatibilityDates: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetaCompatibilityDates"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMetaName: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetaName"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMetaStatus: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetaStatus"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMilitaryCampaignsListing: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MilitaryCampaignsListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMilitaryCampaignsDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the military campaign */
                campaign_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MilitaryCampaignsDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMilitaryCampaignsObjectivesListing: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the military campaign */
                campaign_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MilitaryCampaignsObjectivesListing"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetMilitaryCampaignsObjectivesDetail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the military campaign */
                campaign_id: components["schemas"]["UUID"];
                /** @description The ID of the objective */
                objective_id: components["schemas"]["UUID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MilitaryCampaignsObjectivesDetail"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetParagonHubSkinr: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParagonHubSkinr"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetParagonHubSkinrAlliances: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the alliance the listings are targeted at */
                alliance_id: components["schemas"]["AllianceID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParagonHubSkinrAlliances"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetParagonHubSkinrCharacters: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the character the listings are targeted at */
                character_id: components["schemas"]["CharacterID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParagonHubSkinrCharacters"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetParagonHubSkinrCorporations: {
        parameters: {
            query?: {
                /** @description Return records from after this cursor (mutual exclusive with 'before'). '0' to start from the beginning. */
                after?: string;
                /** @description Return records from before this cursor (mutual exclusive with 'after'). '0' to start from the end. */
                before?: string;
                /** @description The amount of records to retrieve per request. */
                limit?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description The ID of the corporation the listings are targeted at */
                corporation_id: components["schemas"]["CorporationID"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ParagonHubSkinrCorporations"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostRoute: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                /** @description Origin system */
                origin_system_id: components["schemas"]["SolarSystemID"];
                /** @description Destination system */
                destination_system_id: components["schemas"]["SolarSystemID"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteRequestBody"];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Route"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetSkyhooksRaidable: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SkyhooksRaidable"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetSovereigntyCampaigns: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SovereigntyCampaignsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetSovereigntySystems: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SovereigntySystems"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetStatus: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Status"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUiAutopilotWaypoint: {
        parameters: {
            query: {
                add_to_beginning: boolean;
                clear_other_waypoints: boolean;
                destination_id: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Open window request received */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUiOpenwindowContract: {
        parameters: {
            query: {
                contract_id: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Open window request received */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUiOpenwindowInformation: {
        parameters: {
            query: {
                target_id: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Open window request received */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUiOpenwindowMarketdetails: {
        parameters: {
            query: {
                type_id: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Open window request received */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUiOpenwindowNewmail: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    body: string;
                    recipients: number[];
                    subject: string;
                    /** Format: int64 */
                    to_corp_or_alliance_id?: number;
                    /**
                     * Format: int64
                     * @description Corporations, alliances and mailing lists are all types of mailing groups. You may only send to one mailing group, at a time, so you may fill out either this field or the to_corp_or_alliance_ids field
                     */
                    to_mailing_list_id?: number;
                };
            };
        };
        responses: {
            /** @description Open window request received */
            204: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseAncestries: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseAncestriesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseAsteroidBeltsAsteroidBeltId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                asteroid_belt_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseAsteroidBeltsAsteroidBeltIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseBloodlines: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseBloodlinesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseCategories: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseCategoriesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseCategoriesCategoryId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                category_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseCategoriesCategoryIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseConstellations: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseConstellationsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseConstellationsConstellationId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                constellation_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseConstellationsConstellationIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseFactions: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseFactionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseGraphics: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseGraphicsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseGraphicsGraphicId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                graphic_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseGraphicsGraphicIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseGroups: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseGroupsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseGroupsGroupId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                group_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseGroupsGroupIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUniverseIds: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": string[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseIdsPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseMoonsMoonId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                moon_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseMoonsMoonIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    PostUniverseNames: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": number[];
            };
        };
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseNamesPost"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniversePlanetsPlanetId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                planet_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniversePlanetsPlanetIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseRaces: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseRacesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseRegions: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseRegionsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseRegionsRegionId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                region_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseRegionsRegionIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseSchematicsSchematicId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                schematic_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseSchematicsSchematicIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseStargatesStargateId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                stargate_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseStargatesStargateIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseStarsStarId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                star_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseStarsStarIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseStationsStationId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                station_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseStationsStationIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseStructures: {
        parameters: {
            query?: {
                filter?: "market" | "manufacturing_basic";
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseStructuresGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseStructuresStructureId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                structure_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseStructuresStructureIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseSystemJumps: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseSystemJumpsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseSystemKills: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseSystemKillsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseSystems: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseSystemsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseSystemsSystemId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                system_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseSystemsSystemIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseTypes: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseTypesGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetUniverseTypesTypeId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                type_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    "Content-Language": components["headers"]["ContentLanguage"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UniverseTypesTypeIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetWars: {
        parameters: {
            query?: {
                max_war_id?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WarsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetWarsWarId: {
        parameters: {
            query?: never;
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                war_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WarsWarIdGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
    GetWarsWarIdKillmails: {
        parameters: {
            query?: {
                page?: number;
            };
            header: {
                /** @description The language to use for the response. */
                "Accept-Language"?: components["parameters"]["AcceptLanguage"];
                /** @description The ETag of the previous request. A 304 will be returned if this matches the current ETag. */
                "If-None-Match"?: components["parameters"]["IfNoneMatch"];
                /** @description The compatibility date for the request. */
                "X-Compatibility-Date": components["parameters"]["CompatibilityDate"];
                /**
                 * @description The tenant ID for the request.
                 * @example
                 */
                "X-Tenant"?: components["parameters"]["Tenant"];
                /** @description The date the resource was last modified. A 304 will be returned if the resource has not been modified since this date. */
                "If-Modified-Since"?: components["parameters"]["IfModifiedSince"];
            };
            path: {
                war_id: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    "Cache-Control": components["headers"]["CacheControl"];
                    ETag: components["headers"]["ETag"];
                    "Last-Modified": components["headers"]["LastModified"];
                    /** @description The total number of pages in the result set. */
                    "X-Pages"?: number;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WarsWarIdKillmailsGet"];
                };
            };
            /** @description Error */
            default: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Error"];
                };
            };
        };
    };
}
