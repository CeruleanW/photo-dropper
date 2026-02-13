# Photo Picker

## Overview

The idea of this project is to create a web application that can automatically integrate with a user's photo library (e.g. Google Photos, iCloud, etc.) and automatically pick the next photo the user want to see based on a user's preferences, current context, review history, and other signals. 

## Features

- [ ] Integrate with Google Photos API
- [ ] Integrate with iCloud API
- [ ] Randomly pick photos from the library and display them
- [ ] Store the last time the photo was displayed
- [ ] Based on the last time the photo was displayed, when user is picking the next photo, the photo that was displayed most recently should be shown less frequently
- [ ] User can like/dislike photos
- [ ] User can skip photos
- [ ] User can favorite photos
- [ ] User can add tags to photos
- [ ] User can add comments to photos
- [ ] Extend to support other metadata based picking, e.g. location, date, etc.
    - [ ] User preferences
    - [ ] Current context
    - [ ] Review history
    - [ ] Other signals

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- MongoDB
- Google Photos API
- iCloud API