module.exports = {
    "*.sol": ["./node_modules/.bin/prettier --write", "solhint -q"],
    "*.js": ["./node_modules/.bin/prettier --write"],
};
