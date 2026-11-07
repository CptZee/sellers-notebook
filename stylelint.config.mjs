/** @type {import("stylelint").Config} */
export default {
    // Prettier controls presentation. These rules catch invalid or accidental CSS.
    // Repeated selectors are allowed because the existing theme/responsive cascade uses them.
    rules: {
        "at-rule-no-unknown": true,
        "block-no-empty": true,
        "color-no-invalid-hex": true,
        "declaration-block-no-duplicate-custom-properties": true,
        "declaration-block-no-duplicate-properties": [
            true,
            { ignore: ["consecutive-duplicates-with-different-values"] },
        ],
        "font-family-no-duplicate-names": true,
        "function-calc-no-unspaced-operator": true,
        "keyframe-block-no-duplicate-selectors": true,
        "no-invalid-position-at-import-rule": true,
        "property-no-unknown": [true, { checkPrefixed: false }],
        "selector-pseudo-class-no-unknown": true,
        "selector-pseudo-element-no-unknown": true,
        "unit-no-unknown": true,
    },
};
