module.exports = {
    norpc: true,
    skipFiles: ["mock"],
    configureYulOptimizer: true,
    measureStatementCoverage: true,
    measureFunctionCoverage: true,
    solcOptimizerDetails: {
        peephole: false,
        inliner: false,
        jumpdestRemover: false,
        orderLiterals: true, // <-- TRUE! Stack too deep when false
        deduplicate: false,
        cse: false,
        constantOptimizer: false,
        yul: true,
    },
};
