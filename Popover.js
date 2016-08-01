'use strict';

import React, {PropTypes} from 'react';
import {StyleSheet, Dimensions, Animated, Text, TouchableWithoutFeedback, View} from 'react-native';
import _ from 'underscore';

var flattenStyle = require('react-native/Libraries/StyleSheet/flattenStyle');
var Easing = require('react-native/Libraries/Animated/src/Easing');
var noop = () => {};

var {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');
var DEFAULT_ARROW_SIZE = new Size(16, 8);
const PLACEMENT_OPTIONS = {
    TOP: 'top',
    RIGHT: 'right',
    BOTTOM: 'bottom',
    LEFT: 'left',
    AUTO: 'auto'
};

function Point(x, y) {
    this.x = x;
    this.y = y;
}

function Size(width, height) {
    this.width = width;
    this.height = height;
}

function Rect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
}

var Popover = React.createClass({
    propTypes: {
        isVisible: PropTypes.bool,
        onClose: PropTypes.func,
        title: PropTypes.node,
        mode: PropTypes.string
    },

    getInitialState() {
        return {
            contentSize: {},
            anchorPoint: {},
            popoverOrigin: {},
            placement: PLACEMENT_OPTIONS.AUTO,
            isTransitioning: false,
            defaultAnimatedValues: {
                scale: new Animated.Value(0),
                translate: new Animated.ValueXY(),
                fade: new Animated.Value(0)
            }
        };
    },

    getDefaultProps() {
        return {
            isVisible: false,
            displayArea: new Rect(10, 10, SCREEN_WIDTH-20, SCREEN_HEIGHT-20),
            arrowSize: DEFAULT_ARROW_SIZE,
            placement: PLACEMENT_OPTIONS.AUTO,
            onClose: noop,
            mode: 'popover'
        };
    },

    measureContent(x) {
        var {width, height} = x.nativeEvent.layout;
        var contentSize = {width, height};
        var geom = this.computeGeometry({contentSize});

        var isAwaitingShow = this.state.isAwaitingShow;
        
        //Debounce to prevent flickering when displaying a popover with content
        //that doesn't show immediately.
        this.updateState(Object.assign(geom, {contentSize, isAwaitingShow: undefined}), () => {
            // Once state is set, call the showHandler so it can access all the geometry
            // from the state
            isAwaitingShow && this._startAnimation({show: true});
        });
    },

    updateState(state, callback) {
        if(!this._updateState) {
            this._updateState = _.debounce(this.setState.bind(this), 100);
        }
        this._updateState(state, callback);
    },

    computeGeometry({contentSize, placement}, fromRect) {
        placement = placement || this.props.placement;
        fromRect = fromRect || this.props.fromRect;

        //check to see if the mode is select
        //and pass in a dummy arrowSize object
        var arrowSize;
        if (this.props.mode === 'select') {
            arrowSize = {
                height: 0,
                width: 0
            };
        } else {
            arrowSize = this.getArrowSize(placement);
        }

        // To check if fromRect is having screen dimensions
        var displayArea;
        if (fromRect.SCREEN_WIDTH != undefined && fromRect.SCREEN_HEIGHT != undefined) {
            displayArea = new Rect(10, 10, fromRect.SCREEN_WIDTH-20, fromRect.SCREEN_HEIGHT-20);
        } else {
            displayArea = this.props.displayArea;
        }

        var options = {
            displayArea: displayArea,
            fromRect: fromRect,
            arrowSize: arrowSize,
            contentSize
        }

        switch (placement) {
        case PLACEMENT_OPTIONS.TOP:
            return this.computeTopGeometry(options);
        case PLACEMENT_OPTIONS.BOTTOM:
            return this.computeBottomGeometry(options);
        case PLACEMENT_OPTIONS.LEFT:
            return this.computeLeftGeometry(options);
        case PLACEMENT_OPTIONS.RIGHT:
            return this.computeRightGeometry(options);
        default:
            return this.computeAutoGeometry(options);
        }
    },

    computeTopGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        var popoverOrigin = new Point(
            Math.min(displayArea.x + displayArea.width - contentSize.width,
                Math.max(displayArea.x, fromRect.x + (fromRect.width - contentSize.width) / 2)),
            fromRect.y - contentSize.height - arrowSize.height);

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.TOP
        }
    },

    computeBottomGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        var popoverOrigin = new Point(
            Math.min(displayArea.x + displayArea.width - contentSize.width,
                Math.max(displayArea.x, fromRect.x + (fromRect.width - contentSize.width) / 2)),
            fromRect.y + fromRect.height + arrowSize.height);

        var anchorPoint = new Point(fromRect.x + fromRect.width / 2.0, fromRect.y + fromRect.height);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.BOTTOM
        }
    },

    computeLeftGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        var popoverOrigin = new Point(fromRect.x - contentSize.width - arrowSize.width,
            Math.min(displayArea.y + displayArea.height - contentSize.height,
                Math.max(displayArea.y, fromRect.y + (fromRect.height - contentSize.height) / 2)));

        var anchorPoint = new Point(fromRect.x, fromRect.y + fromRect.height / 2.0);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.LEFT
        }
    },

    computeRightGeometry({displayArea, fromRect, contentSize, arrowSize}) {
        var popoverOrigin = new Point(fromRect.x + fromRect.width + arrowSize.width,
            Math.min(displayArea.y + displayArea.height - contentSize.height,
                Math.max(displayArea.y, fromRect.y + (fromRect.height - contentSize.height) / 2)));

        var anchorPoint = new Point(fromRect.x + fromRect.width, fromRect.y + fromRect.height / 2.0);

        return {
            popoverOrigin,
            anchorPoint,
            placement: PLACEMENT_OPTIONS.RIGHT
        }
    },

    computeAutoGeometry({displayArea, contentSize}) {
        let placementsToTry;
        if (this.props.mode === 'popover') {
            placementsToTry = ['left', 'right', 'bottom', 'top'];
        } else {
            placementsToTry = ['bottom', 'top'];
        }

        for (var i = 0; i < placementsToTry.length; i++) {
            var placement = placementsToTry[i];
            var geom = this.computeGeometry({contentSize: contentSize, placement: placement});
            var {popoverOrigin} = geom;

            if (popoverOrigin.x >= displayArea.x
                && popoverOrigin.x <= displayArea.x + displayArea.width - contentSize.width
                && popoverOrigin.y >= displayArea.y
                && popoverOrigin.y <= displayArea.y + displayArea.height - contentSize.height) {
                    break;
                }
        }

        return geom;
    },

    getArrowSize(placement) {
        var size = this.props.arrowSize;
        switch(placement) {
            case PLACEMENT_OPTIONS.LEFT:
            case PLACEMENT_OPTIONS.RIGHT:
                return new Size(size.height, size.width);
            default:
                return size;
        }
    },

    getArrowColorStyle(color) {
        return { borderTopColor: color };
    },

    getArrowRotation(placement) {
        switch (placement) {
            case PLACEMENT_OPTIONS.BOTTOM:
                return '180deg';
            case PLACEMENT_OPTIONS.LEFT:
                return '-90deg';
            case PLACEMENT_OPTIONS.RIGHT:
                return '90deg';
            default:
                return '0deg';
        }
    },

    getArrowDynamicStyle() {
        var {anchorPoint, popoverOrigin} = this.state;
        var arrowSize = this.props.arrowSize;

        // Create the arrow from a rectangle with the appropriate borderXWidth set
        // A rotation is then applied dependending on the placement
        // Also make it slightly bigger
        // to fix a visual artifact when the popover is animated with a scale
        var width = arrowSize.width + 2;
        var height = arrowSize.height * 2 + 2;

        return {
            left: anchorPoint.x - popoverOrigin.x - width / 2,
            top: anchorPoint.y - popoverOrigin.y - height / 2,
            width: width,
            height: height,
            borderTopWidth: height / 2,
            borderRightWidth: width / 2,
            borderBottomWidth: height / 2,
            borderLeftWidth: width / 2,
        }
    },

    getTranslateOrigin() {
        var {contentSize, popoverOrigin, anchorPoint} = this.state;

        var popoverCenter = new Point(popoverOrigin.x + contentSize.width / 2,
            popoverOrigin.y + contentSize.height / 2);
        return new Point(anchorPoint.x - popoverCenter.x, anchorPoint.y - popoverCenter.y);
    },

    componentWillReceiveProps(nextProps:any) {
        var willBeVisible = nextProps.isVisible;
        var {
            isVisible,
            fromRect
        } = this.props;

        if (willBeVisible !== isVisible) {
            if (willBeVisible) {
                // We want to start the show animation only when contentSize is known
                // so that we can have some logic depending on the geometry
                this.setState({contentSize: {}, isAwaitingShow: true});
            } else {
                this._startAnimation({show: false});
            }
        } else if (willBeVisible && nextProps.fromRect !== fromRect) {
            var contentSize = this.state.contentSize;

            var geom = this.computeGeometry({contentSize}, nextProps.fromRect);

            var isAwaitingShow = this.state.isAwaitingShow;
            this.setState(Object.assign(geom, {contentSize, isAwaitingShow: undefined}), () => {
                // Once state is set, call the showHandler so it can access all the geometry
                // from the state
                isAwaitingShow && this._startAnimation({show: true});

            });
        }
    },

    _startAnimation({show}) {
        var handler = this.props.startCustomAnimation || this._startDefaultAnimation;
        handler({show, doneCallback: () => this.setState({isTransitioning: false})});
        this.setState({isTransitioning: true});
    },

    _startDefaultAnimation({show, doneCallback}) {
        var animDuration = 300;
        var values = this.state.defaultAnimatedValues;
        var translateOrigin = this.getTranslateOrigin();

        if (show) {
            values.translate.setValue(translateOrigin);
        }

        var commonConfig = {
            duration: animDuration,
            easing: show ? Easing.out(Easing.back()) : Easing.inOut(Easing.quad),
        }

        Animated.parallel([
            Animated.timing(values.fade, {
                toValue: show ? 1 : 0,
                ...commonConfig,
            }),
            Animated.timing(values.translate, {
                toValue: show ? new Point(0, 0) : translateOrigin,
                ...commonConfig,
            }),
            Animated.timing(values.scale, {
                toValue: show ? 1 : 0,
                ...commonConfig,
            })
        ]).start(doneCallback);
    },

    _getDefaultAnimatedStyles() {
        // If there's a custom animation handler,
        // we don't return the default animated styles
        if (typeof this.props.startCustomAnimation !== 'undefined') {
            return null;
        }

        var animatedValues = this.state.defaultAnimatedValues;

        return {
            backgroundStyle: {
                opacity: animatedValues.fade,
            },
            arrowStyle: {
                transform: [
                    {
                        scale: animatedValues.scale.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                        }),
                    }
                ],
            },
            contentStyle: {
                transform: [
                    {translateX: animatedValues.translate.x},
                    {translateY: animatedValues.translate.y},
                    {scale: animatedValues.scale},
                ],
            }
        };
    },

    _getExtendedStyles() {
        var background = [];
        var popover = [];
        var arrow = [];
        var content = [];

        [this._getDefaultAnimatedStyles(), this.props].forEach((source) => {
            if (source) {
                background.push(source.backgroundStyle);
                popover.push(source.popoverStyle);
                arrow.push(source.arrowStyle);
                content.push(source.contentStyle);
            }
        });

        return {
            background,
            popover,
            arrow,
            content
        }
    },

    render() {
        if (!this.props.isVisible && !this.state.isTransitioning) {
            return null;
        }

        var {popoverOrigin, placement} = this.state;
        var extendedStyles = this._getExtendedStyles();
        var contentContainerStyle = [styles.contentContainer, ...extendedStyles.content];
        var contentModeStyling;
        var dropShadowStyling;
        var contentStyle;
        var arrowColorStyle;
        var arrowDynamicStyle = this.getArrowDynamicStyle();

        //apply the relevant style required
        if (this.props.mode === 'select') {
            contentModeStyling = styles.selectContainer;
            dropShadowStyling = null;
        } else {
            contentModeStyling = styles.popoverContainer;
            dropShadowStyling = styles.dropShadow;
            contentStyle = this.props.title == null ? [styles.popoverContent, styles.popoverTopRadius] : styles.popoverContent;
            
            if (placement === PLACEMENT_OPTIONS.TOP) {
                arrowColorStyle = this.getArrowColorStyle(flattenStyle(styles.title).backgroundColor);
            } else {
                arrowColorStyle = this.getArrowColorStyle(flattenStyle(styles.popoverContent).backgroundColor);
            } 
        }
        // Special case, force the arrow rotation even if it was overriden
        var arrowStyle = [styles.arrow, arrowDynamicStyle, arrowColorStyle, ...extendedStyles.arrow];
        var arrowTransform = (flattenStyle(arrowStyle).transform || []).slice(0);
        arrowTransform.unshift({rotate: this.getArrowRotation(placement)});
        arrowStyle = [...arrowStyle, {transform: arrowTransform}];

        var titleStyle = styles.title;
        var contentSizeAvailable = this.state.contentSize.width;

        return (
            <TouchableWithoutFeedback onPress={this.props.onClose}>
                <View style={[styles.container, contentSizeAvailable && styles.containerVisible]}>
                    <Animated.View style={[{top: popoverOrigin.y, left: popoverOrigin.x,}, ...extendedStyles.popover]}>
                        <Animated.View ref='content' onLayout={this.measureContent} style={[contentContainerStyle, contentModeStyling]}>
                            {this.props.title !== null && this.props.title !== undefined
                                ?
                                <View style={[titleStyle, {width: contentSizeAvailable}, dropShadowStyling]}>
                                    <Text style={styles.titleText}>{this.props.title}</Text>
                                </View>
                                : null
                            }
                            <Animated.View style={[{width: contentSizeAvailable}, contentStyle, dropShadowStyling]}>
                                {this.props.children}
                            </Animated.View>
                        </Animated.View>
                        {this.props.mode === 'popover'
                            ? <Animated.View style={arrowStyle}/>
                            : null
                        }

                    </Animated.View>
                </View>
            </TouchableWithoutFeedback>
        );
    }
});

var styles = StyleSheet.create({
    container: {
        opacity: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        position: 'absolute',
        backgroundColor: 'transparent'
    },
    containerVisible: {
        opacity: 1
    },
    background: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        position: 'absolute',
        backgroundColor: 'rgba(0,0,0,0)'
    },
    contentContainer: {
        flexDirection: 'column',
    },
    popoverContainer: {
        position: 'absolute'
    },
    popoverContent: {
        backgroundColor: '#333438',
        borderBottomLeftRadius: 9,
        borderBottomRightRadius: 9,
        borderBottomColor: '#333438'
    },
    popoverTopRadius: {
        borderTopLeftRadius: 9,
        borderTopRightRadius: 9
    },
    selectContainer: {
        backgroundColor: '#f2f2f2',
        position: 'absolute'
    },
    dropShadow: {
        shadowColor: 'black',
        shadowOffset: {width: 0, height: 2},
        shadowRadius: 2,
        shadowOpacity: 0.8
    },
    title: {
        alignItems: 'center',
        backgroundColor: '#28292c',
        borderTopLeftRadius: 9,
        borderTopRightRadius: 9,
        borderTopColor: '#28292c',
        padding: 6
    },
    titleText: {
        justifyContent: 'center',
        alignSelf: 'center',
        color: '#fff'
    },
    arrow: {
        position: 'absolute',
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent'
    }
});

module.exports = Popover;
