// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../IKernel.sol";

interface IOperatorFactoryState {
    /// @notice Returns the parameters for tweaking the created sequencer traniently.
    function parameters() external view returns (IKernel kernel_, address token);
}
