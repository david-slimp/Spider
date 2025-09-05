# Changelog

## [0.0.6] - 2025-09-05
### Added
- New `SUIT` constant for consistent card suit representation
- Proper Unicode suit symbols (♠, ♦, ♥, ♣) for better visual representation
- Improved suit distribution in deck creation

### Changed
- Updated deck creation to use the new `SUIT` constants
- Enhanced code readability with named suit constants
- Improved type safety in suit handling

## [0.0.5] - 2025-09-04

## [0.0.5] - 2025-09-04
### Added
- New comprehensive game history system with persistent storage
- Deduplication of game history by seed and difficulty
- Automatic cleanup of duplicate game entries
- Improved statistics panel with detailed game history
- Ability to resume in-progress games from history
- Replay functionality for completed games
- Enhanced timer system that persists across page refreshes
- Visual indicators for in-progress and completed games
- Detailed move tracking and state snapshots
- Automatic save after every move

### Changed
- Replaced old stats system with new history-based implementation
- Improved game state serialization for better reliability
- Updated UI for history panel with better organization
- Enhanced game loading/saving mechanism
- Improved timer accuracy and persistence
- Streamlined game initialization process

### Removed
- Legacy stats and persistence system
- Redundant game state management code
- Unused statistics tracking functions

## [0.0.4] - 2025-08-21
### Added
- Enhanced audio system with WebAudio API
- New sound effects for card interactions (click on select, thud on drop)
- Mute button with persistent state
- Audio feedback for game actions
- Visual feedback for audio state
- spider-thumb-01.png for the sample play image
- Added README.md for GitHub

### Changed
- Improved UI layout and fixed column numbers
- Increased font sizes for better readability
- Moved sets counter for better visual hierarchy
- Resized toolbar for improved usability
- Various UI/UX improvements and bug fixes

## [0.0.3] - 2025-08-21
### Added
- Comprehensive game statistics tracking (moves, time, score, outcomes)
- Auto-save functionality to preserve game progress
- Game recovery for interrupted sessions
- Persistent storage of game history and best scores
- Statistics tracking by difficulty level
- Support for tracking incomplete/abandoned games
- Statistics modal UI with overall game metrics
- Recent game history display
- Win/loss tracking and streak counters
- Best time, moves, and score tracking
- Visual indicators for game outcomes in history
- Stats button in the main game interface
- Proper error handling for game state management

## [0.0.2] - 2025-08-21
### Added
- Version number to the game UI
- Support for custom game seeds via URL parameter
- Game state persistence using localStorage
- Visual feedback for empty columns during deal

### Changed
- Improved card styling with white background for face-up cards
- Enhanced text contrast with proper red/black coloring for suits and ranks
- Updated UI layout with better spacing and visual hierarchy
- Improved card shadows and depth perception
- Reduced modal backdrop blur from 3px to 1px for better readability

### Fixed
- Fixed card rendering to ensure consistent appearance
- Improved visual feedback for valid moves
- Addressed minor layout issues in the game interface
- Fixed timer initialization to ensure it starts counting when a new game begins

## [0.0.1] - 2025-08-20
### Initial Release

### Added
- LICENSE.txt - AGPL3
- Default .gitignore
- PRD.md from ChatGPT-5 (Thinking)
- index.html - fully runable from chatGPT-5 - this is pretty much a MVP version already!

### Changed
- CHANGELOG.md

### Known Issues
- Need to create MVP.md and dev_notes.txt
- Default README.md

