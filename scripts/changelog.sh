#!/bin/bash
# Generate changelog entries from git commits
# Usage: ./scripts/changelog.sh [from-tag] [to-tag]

set -e

FROM_TAG=${1:-$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")}
TO_TAG=${2:-HEAD}

echo "## Changes"
echo ""

if [ -z "$FROM_TAG" ]; then
    # First release - get all commits
    COMMITS=$(git log --oneline --pretty=format:"%s" "$TO_TAG")
else
    COMMITS=$(git log --oneline --pretty=format:"%s" "$FROM_TAG..$TO_TAG")
fi

# Categorize commits
FEATURES=""
FIXES=""
SECURITY=""
DOCS=""
OTHER=""

while IFS= read -r line; do
    case "$line" in
        feat:*|feature:*|add:*)
            FEATURES="$FEATURES\n- ${line#*: }"
            ;;
        fix:*|bugfix:*)
            FIXES="$FIXES\n- ${line#*: }"
            ;;
        security:*|sec:*)
            SECURITY="$SECURITY\n- ${line#*: }"
            ;;
        docs:*|doc:*)
            DOCS="$DOCS\n- ${line#*: }"
            ;;
        Phase\ *)
            # Special handling for Phase commits
            FEATURES="$FEATURES\n- $line"
            ;;
        *)
            if [ -n "$line" ]; then
                OTHER="$OTHER\n- $line"
            fi
            ;;
    esac
done <<< "$COMMITS"

if [ -n "$FEATURES" ]; then
    echo "### Added"
    echo -e "$FEATURES"
    echo ""
fi

if [ -n "$FIXES" ]; then
    echo "### Fixed"
    echo -e "$FIXES"
    echo ""
fi

if [ -n "$SECURITY" ]; then
    echo "### Security"
    echo -e "$SECURITY"
    echo ""
fi

if [ -n "$DOCS" ]; then
    echo "### Documentation"
    echo -e "$DOCS"
    echo ""
fi

if [ -n "$OTHER" ]; then
    echo "### Other"
    echo -e "$OTHER"
    echo ""
fi
