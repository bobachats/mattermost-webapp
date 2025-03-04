// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ActionsMenu from 'components/actions_menu';

import {Posts, Preferences} from 'mattermost-redux/constants';
import * as ReduxPostUtils from 'mattermost-redux/utils/post_utils';

import {Post} from 'mattermost-redux/types/posts';
import {ExtendedPost} from 'mattermost-redux/actions/posts';

import {trackEvent} from 'actions/telemetry_actions';
import * as PostUtils from 'utils/post_utils';
import * as Utils from 'utils/utils.jsx';
import Constants, {EventTypes, TELEMETRY_CATEGORIES, TELEMETRY_LABELS, Locations} from 'utils/constants';
import CommentIcon from 'components/post_view/comment_icon';
import DotMenu from 'components/dot_menu';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import PostFlagIcon from 'components/post_view/post_flag_icon';
import PostReaction from 'components/post_view/post_reaction';
import PostRecentReactions from 'components/post_view/post_recent_reactions';
import PostTime from 'components/post_view/post_time';
import InfoSmallIcon from 'components/widgets/icons/info_small_icon';
import {Emoji} from 'mattermost-redux/types/emojis';

type Props = {

    /**
     * The post to render the info for
     */
    post: Post;

    /**
     * The id of the team which belongs the post
     */
    teamId?: string;

    /**
     * Function called when the comment icon is clicked
     */
    handleCommentClick: React.EventHandler<React.MouseEvent>;

    /**
     * Function called when the card icon is clicked
     */
    handleCardClick: (post: Post) => void;

    /**
     * Function called when the post options dropdown is opened
     */
    handleDropdownOpened: (e: boolean) => void;

    /**
     * Set to mark the post as flagged
     */
    isFlagged?: boolean;

    /**
     * Set to mark the post as open the extra info in the rhs
     */
    isCardOpen?: boolean;

    /**
     * Set to indicate that this is previous post was not a reply to the same thread
     */
    isFirstReply?: boolean;

    /**
     * Set to indicate that this is post has replies
     */
    hasReplies?: boolean;

    /**
     * Set to render in mobile view
     */
    isMobile?: boolean;

    /**
     * Set to render in compact view
     */
    compactDisplay?: boolean;

    /**
     * Set to mark post as being hovered over
     */
    hover: boolean;

    /**
     * Set to render the post time when not hovering
     */
    showTimeWithoutHover: boolean;

    /**
     * Whether to show the emoji picker.
     */
    enableEmojiPicker?: boolean;

    /**
     * Set not to allow edits on post
     */
    isReadOnly: boolean | null;

    /**
     * To check if the state of emoji for last message and from where it was emitted
     */
    shortcutReactToLastPostEmittedFrom?: string;

    /**
     * To Check if the current post is last in the list
     */
    isLastPost?: boolean;

    /**
     * true when want to show the Actions Menu with pulsating dot for tutorial
     */
    showActionsMenuPulsatingDot: boolean;

    actions: {

        /**
         * Function to remove the post
         */
        removePost: (post: ExtendedPost) => void;

        /**
         * Function to set or unset emoji picker for last message
         */
        emitShortcutReactToLastPostFrom?: (emittedFrom: string) => void;

        /**
         * Function to set viewed Actions Menu for first time
         */
        setActionsMenuInitialisationState: (viewed: Record<string, boolean>) => void;
    };

    isPostBeingEdited: boolean;

    shouldShowDotMenu: boolean;

    shouldShowActionsMenu: boolean;

    collapsedThreadsEnabled: boolean;

    oneClickReactionsEnabled: boolean;
    recentEmojis: Emoji[];
};

type State = {
    showEmojiPicker: boolean;
    showDotMenu: boolean;
    showActionsMenu: boolean;
    showOptionsMenuWithoutHover: boolean;
    showActionTip: boolean;
};

export default class PostInfo extends React.PureComponent<Props, State> {
    private postHeaderRef: React.RefObject<HTMLDivElement>;
    private dotMenuRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            showEmojiPicker: false,
            showOptionsMenuWithoutHover: false,
            showDotMenu: false,
            showActionsMenu: false,
            showActionTip: false,
        };

        this.postHeaderRef = React.createRef<HTMLDivElement>();
        this.dotMenuRef = React.createRef<HTMLDivElement>();
    }

    toggleEmojiPicker = (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        if (e) {
            e.stopPropagation();
        }
        const showEmojiPicker = !this.state.showEmojiPicker;

        this.setState({
            showEmojiPicker,
            showOptionsMenuWithoutHover: false,
        });
        this.props.handleDropdownOpened(showEmojiPicker);
    };

    removePost = (): void => this.props.actions.removePost(this.props.post);

    createRemovePostButton = (): JSX.Element => {
        return (
            <button
                className='post__remove theme color--link style--none'
                type='button'
                onClick={this.removePost}
            >
                {'×'}
            </button>
        );
    };

    handleDotMenuOpened = (open: boolean): void => {
        this.setState({showDotMenu: open});
        this.props.handleDropdownOpened(open || this.state.showEmojiPicker);
    };

    handleActionsMenuOpened = (open: boolean) => {
        if (this.props.showActionsMenuPulsatingDot) {
            return;
        }
        this.props.handleDropdownOpened(open);
        this.setState({showActionsMenu: open});
        this.props.handleDropdownOpened(open);
    };

    handleActionsMenuTipOpened = (): void => {
        this.setState({showActionTip: true});
        this.props.handleDropdownOpened(true);
    };

    handleActionsMenuGotItClick = (): void => {
        this.props.actions.setActionsMenuInitialisationState({[Preferences.ACTIONS_MENU_VIEWED]: true});
        this.props.handleDropdownOpened(false);
        this.setState({showActionTip: false});
    };

    handleTipDismissed = () => {
        this.props.actions.setActionsMenuInitialisationState({[Preferences.ACTIONS_MENU_VIEWED]: false});
        this.props.handleDropdownOpened(false);
        this.setState({showActionTip: false});
    };

    handleCommentClick = (e: any) => {
        trackEvent(TELEMETRY_CATEGORIES.POST_INFO, EventTypes.CLICK + '_' + TELEMETRY_LABELS.REPLY);
        this.props.handleCommentClick(e);
    }

    getDotMenu = (): HTMLDivElement => this.dotMenuRef.current as HTMLDivElement;

    buildOptions = (post: Post, isSystemMessage: boolean, fromAutoResponder: boolean): React.ReactNode => {
        if (!this.props.shouldShowDotMenu || this.props.isPostBeingEdited) {
            return null;
        }

        const {isMobile, isReadOnly, collapsedThreadsEnabled} = this.props;

        const hover = this.props.hover ||
            this.state.showEmojiPicker ||
            this.state.showDotMenu ||
            this.state.showActionsMenu ||
            this.state.showActionTip ||
            this.state.showOptionsMenuWithoutHover;

        const showCommentIcon = fromAutoResponder ||
        (!isSystemMessage && (isMobile || hover || (!post.root_id && Boolean(this.props.hasReplies)) || this.props.isFirstReply));
        const commentIconExtraClass = isMobile ? '' : 'pull-right';
        let commentIcon;
        if (showCommentIcon) {
            commentIcon = (
                <CommentIcon
                    handleCommentClick={this.handleCommentClick}
                    postId={post.id}
                    extraClass={commentIconExtraClass}
                />
            );
        }

        const showRecentlyUsedReactions = !isMobile && !isSystemMessage && hover && !isReadOnly && this.props.oneClickReactionsEnabled && this.props.enableEmojiPicker;
        let showRecentReacions;
        if (showRecentlyUsedReactions) {
            showRecentReacions = (
                <PostRecentReactions
                    channelId={post.channel_id}
                    postId={post.id}
                    emojis={this.props.recentEmojis}
                    teamId={this.props.teamId}
                    getDotMenuRef={this.getDotMenu}
                />
            );
        }

        const showReactionIcon = !isSystemMessage && hover && !isReadOnly && this.props.enableEmojiPicker;
        let postReaction;
        if (showReactionIcon) {
            postReaction = (
                <PostReaction
                    channelId={post.channel_id}
                    postId={post.id}
                    teamId={this.props.teamId}
                    getDotMenuRef={this.getDotMenu}
                    showEmojiPicker={this.state.showEmojiPicker}
                    toggleEmojiPicker={this.toggleEmojiPicker}
                />
            );
        }

        const showDotMenuIcon = isMobile || hover;
        let dotMenu;
        if (showDotMenuIcon) {
            dotMenu = (
                <DotMenu
                    post={post}
                    isFlagged={this.props.isFlagged}
                    handleCommentClick={this.props.handleCommentClick}
                    handleDropdownOpened={this.handleDotMenuOpened}
                    handleAddReactionClick={this.toggleEmojiPicker}
                    isMenuOpen={this.state.showDotMenu}
                    isReadOnly={isReadOnly}
                    enableEmojiPicker={this.props.enableEmojiPicker}
                />
            );
        }

        const showActionsMenuIcon = this.props.shouldShowActionsMenu && (isMobile || hover);
        const actionsMenu = showActionsMenuIcon && (
            <ActionsMenu
                post={post}
                handleDropdownOpened={this.handleActionsMenuOpened}
                isMenuOpen={this.state.showActionsMenu}
                showPulsatingDot={this.props.showActionsMenuPulsatingDot}
                showTutorialTip={this.state.showActionTip}
                handleOpenTip={this.handleActionsMenuTipOpened}
                handleNextTip={this.handleActionsMenuGotItClick}
                handleDismissTip={this.handleTipDismissed}
            />
        );

        const showFlagIcon = !isSystemMessage && !isMobile && (hover || this.props.isFlagged);
        let postFlagIcon;
        if (showFlagIcon) {
            postFlagIcon = (
                <PostFlagIcon
                    postId={post.id}
                    isFlagged={this.props.isFlagged}
                />
            );
        }

        return (
            <div
                ref={this.dotMenuRef}
                data-testid={`post-menu-${post.id}`}
                className={'col post-menu'}
            >
                {!collapsedThreadsEnabled && !showRecentlyUsedReactions && dotMenu}
                {showRecentReacions}
                {postReaction}
                {postFlagIcon}
                {actionsMenu}
                {commentIcon}
                {(collapsedThreadsEnabled || showRecentlyUsedReactions) && dotMenu}
            </div>
        );
    };

    handleShortcutReactToLastPost = (isLastPost: boolean): void => {
        if (isLastPost) {
            const {post, isReadOnly, enableEmojiPicker, isMobile, actions} = this.props;

            // Setting the last message emoji action to empty to clean up the redux state
            actions.emitShortcutReactToLastPostFrom?.(Locations.NO_WHERE);

            // Following are the types of posts on which adding reaction is not possible
            const isDeletedPost = post && post.state === Posts.POST_DELETED;
            const isEphemeralPost = post && Utils.isPostEphemeral(post);
            const isSystemMessage = post && PostUtils.isSystemMessage(post);
            const isAutoRespondersPost = post && PostUtils.fromAutoResponder(post);
            const isFailedPost = post && post.failed;

            // Checking if post is at scroll view of the user
            const boundingRectOfPostInfo: DOMRect | undefined = this.postHeaderRef?.current?.getBoundingClientRect();
            if (boundingRectOfPostInfo) {
                const isPostHeaderVisibleToUser = (boundingRectOfPostInfo.top - 65) > 0 &&
                    boundingRectOfPostInfo.bottom < (window.innerHeight - 85);

                if (isPostHeaderVisibleToUser && !isEphemeralPost && !isSystemMessage && !isAutoRespondersPost &&
                        !isFailedPost && !isDeletedPost && !isReadOnly && !isMobile && enableEmojiPicker) {
                    this.setState({
                        showOptionsMenuWithoutHover: true,
                    }, () => {
                        this.toggleEmojiPicker();
                    });
                }
            }
        }
    }

    componentDidUpdate(prevProps: Props): void {
        const {shortcutReactToLastPostEmittedFrom, isLastPost} = this.props;

        const shortcutReactToLastPostEmittedFromCenter = prevProps.shortcutReactToLastPostEmittedFrom !== shortcutReactToLastPostEmittedFrom &&
        shortcutReactToLastPostEmittedFrom === Locations.CENTER;
        if (shortcutReactToLastPostEmittedFromCenter && isLastPost !== undefined) {
            this.handleShortcutReactToLastPost(isLastPost);
        }
    }

    render(): React.ReactNode {
        const {post} = this.props;

        const isEphemeral = Utils.isPostEphemeral(post);
        const isSystemMessage = PostUtils.isSystemMessage(post);
        const fromAutoResponder = PostUtils.fromAutoResponder(post);

        let postInfoIcon;
        if (post.props && post.props.card) {
            postInfoIcon = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={
                        <Tooltip id={`viewAdditionalInfo-${post.id}`}>
                            <FormattedMessage
                                id='post_info.info.view_additional_info'
                                defaultMessage='View additional info'
                            />
                        </Tooltip>
                    }
                >
                    <button
                        className={'card-icon__container icon--show style--none ' + (this.props.isCardOpen ? 'active' : '')}
                        onClick={(e) => {
                            e.preventDefault();
                            this.props.handleCardClick(this.props.post);
                        }}
                    >
                        <InfoSmallIcon
                            className='icon icon__info'
                            aria-hidden='true'
                        />
                    </button>
                </OverlayTrigger>
            );
        }

        let options;
        if (isEphemeral) {
            options = (
                <div className='col col__remove'>
                    {this.createRemovePostButton()}
                </div>
            );
        } else if (!post.failed) {
            options = this.buildOptions(post, isSystemMessage, fromAutoResponder);
        }

        let visibleMessage;
        if (isEphemeral && !this.props.compactDisplay && post.state !== Posts.POST_DELETED) {
            visibleMessage = (
                <span className='post__visibility'>
                    <FormattedMessage
                        id='post_info.message.visible'
                        defaultMessage='(Only visible to you)'
                    />
                </span>
            );
        }

        const showPostTime = this.props.hover || this.props.showTimeWithoutHover;
        let postTime;
        if (showPostTime) {
            // timestamp should not be a permalink if the post has been deleted, is ephemeral message, is pending, or is combined activity
            const isPermalink = !(isEphemeral || Posts.POST_DELETED === post.state || ReduxPostUtils.isPostPendingOrFailed(post) || post.type === Posts.POST_TYPES.COMBINED_USER_ACTIVITY);

            postTime = (
                <PostTime
                    isPermalink={isPermalink}
                    eventTime={post.create_at}
                    postId={post.id}
                />
            );
        }

        return (
            <div
                className='post__header--info'
                ref={this.postHeaderRef}
            >
                <div className='col'>
                    {postTime}
                    {postInfoIcon}
                    {visibleMessage}
                </div>
                {options}
            </div>
        );
    }
}
