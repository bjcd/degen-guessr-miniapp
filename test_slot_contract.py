#!/usr/bin/env python3
"""
Basic tests for DegenSlot contract logic validation
Tests the core game mechanics without requiring a blockchain connection
"""

import random
from scripts.slot_simulator import (
    determine_result, Cat, 
    P_JACKPOT_BPS, P_THREE_SAME_BPS, P_TWO_SAME_BPS, 
    P_ONE_HAT_BPS, P_TWO_HATS_BPS, P_NOTHING_BPS,
    THREE_SAME_PAYOUT, TWO_SAME_PAYOUT, ONE_HAT_PAYOUT, TWO_HATS_PAYOUT
)

def test_probability_ranges():
    """Test that probability ranges are correctly defined"""
    print("🧪 Testing probability ranges...")
    
    # Test that ranges add up to 10000
    total_bps = (P_JACKPOT_BPS + P_THREE_SAME_BPS + P_TWO_SAME_BPS + 
                 P_ONE_HAT_BPS + P_TWO_HATS_BPS + P_NOTHING_BPS)
    
    assert total_bps == 10000, f"Total bps should be 10000, got {total_bps}"
    print("✅ Probability ranges sum to 10000 bps")
    
    # Test individual ranges
    assert P_JACKPOT_BPS == 15, f"Jackpot should be 15 bps, got {P_JACKPOT_BPS}"
    assert P_THREE_SAME_BPS == 96, f"Three-same should be 96 bps, got {P_THREE_SAME_BPS}"
    assert P_TWO_SAME_BPS == 1200, f"Two-same should be 1200 bps, got {P_TWO_SAME_BPS}"
    assert P_ONE_HAT_BPS == 3000, f"One-hat should be 3000 bps, got {P_ONE_HAT_BPS}"
    assert P_TWO_HATS_BPS == 50, f"Two-hats should be 50 bps, got {P_TWO_HATS_BPS}"
    assert P_NOTHING_BPS == 5639, f"Nothing should be 5639 bps, got {P_NOTHING_BPS}"
    print("✅ Individual probability ranges are correct")

def test_determine_result():
    """Test the determine_result function with known inputs"""
    print("🧪 Testing determine_result function...")
    
    # Test jackpot (roll 0-14)
    category, payout = determine_result(0, 10000)  # 50% of 10000 = 5000
    assert category == Cat.Jackpot, f"Roll 0 should be Jackpot, got {category}"
    assert payout == 5000, f"Jackpot payout should be 5000, got {payout}"
    
    category, payout = determine_result(14, 20000)  # 50% of 20000 = 10000
    assert category == Cat.Jackpot, f"Roll 14 should be Jackpot, got {category}"
    assert payout == 10000, f"Jackpot payout should be 10000, got {payout}"
    
    # Test three-same (roll 15-110)
    category, payout = determine_result(15, 1000)
    assert category == Cat.ThreeSame, f"Roll 15 should be ThreeSame, got {category}"
    assert payout == THREE_SAME_PAYOUT, f"ThreeSame payout should be {THREE_SAME_PAYOUT}, got {payout}"
    
    # Test two-same (roll 111-1310)
    category, payout = determine_result(111, 1000)
    assert category == Cat.TwoSame, f"Roll 111 should be TwoSame, got {category}"
    assert payout == TWO_SAME_PAYOUT, f"TwoSame payout should be {TWO_SAME_PAYOUT}, got {payout}"
    
    # Test one-hat (roll 1311-4310)
    category, payout = determine_result(1311, 1000)
    assert category == Cat.OneHat, f"Roll 1311 should be OneHat, got {category}"
    assert payout == ONE_HAT_PAYOUT, f"OneHat payout should be {ONE_HAT_PAYOUT}, got {payout}"
    
    # Test two-hats (roll 4311-4360)
    category, payout = determine_result(4311, 1000)
    assert category == Cat.TwoHats, f"Roll 4311 should be TwoHats, got {category}"
    assert payout == TWO_HATS_PAYOUT, f"TwoHats payout should be {TWO_HATS_PAYOUT}, got {payout}"
    
    # Test nothing (roll 4361-9999)
    category, payout = determine_result(4361, 1000)
    assert category == Cat.Nothing, f"Roll 4361 should be Nothing, got {category}"
    assert payout == 0, f"Nothing payout should be 0, got {payout}"
    
    print("✅ determine_result function works correctly")

def test_payout_amounts():
    """Test that payout amounts are correct"""
    print("🧪 Testing payout amounts...")
    
    assert THREE_SAME_PAYOUT == 600, f"ThreeSame payout should be 600, got {THREE_SAME_PAYOUT}"
    assert TWO_SAME_PAYOUT == 300, f"TwoSame payout should be 300, got {TWO_SAME_PAYOUT}"
    assert ONE_HAT_PAYOUT == 50, f"OneHat payout should be 50, got {ONE_HAT_PAYOUT}"
    assert TWO_HATS_PAYOUT == 350, f"TwoHats payout should be 350, got {TWO_HATS_PAYOUT}"
    
    print("✅ Payout amounts are correct")

def test_jackpot_percentage():
    """Test that jackpot is always 50% of current pot"""
    print("🧪 Testing jackpot percentage calculation...")
    
    test_pots = [1000, 5000, 10000, 25000, 50000]
    
    for pot in test_pots:
        category, payout = determine_result(0, pot)  # Roll 0 is always jackpot
        expected_payout = pot // 2
        assert payout == expected_payout, f"Jackpot for pot {pot} should be {expected_payout}, got {payout}"
    
    print("✅ Jackpot is always 50% of current pot")

def test_edge_cases():
    """Test edge cases and boundary conditions"""
    print("🧪 Testing edge cases...")
    
    # Test roll at exact boundaries
    category, payout = determine_result(14, 1000)  # Last jackpot roll
    assert category == Cat.Jackpot, f"Roll 14 should be Jackpot, got {category}"
    
    category, payout = determine_result(15, 1000)  # First three-same roll
    assert category == Cat.ThreeSame, f"Roll 15 should be ThreeSame, got {category}"
    
    category, payout = determine_result(110, 1000)  # Last three-same roll
    assert category == Cat.ThreeSame, f"Roll 110 should be ThreeSame, got {category}"
    
    category, payout = determine_result(111, 1000)  # First two-same roll
    assert category == Cat.TwoSame, f"Roll 111 should be TwoSame, got {category}"
    
    # Test very small pot for jackpot
    category, payout = determine_result(0, 1)  # Pot of 1
    assert category == Cat.Jackpot, f"Roll 0 should be Jackpot, got {category}"
    assert payout == 0, f"Jackpot for pot 1 should be 0, got {payout}"  # 1 // 2 = 0
    
    print("✅ Edge cases handled correctly")

def test_monte_carlo_validation():
    """Run a small Monte Carlo test to validate probabilities"""
    print("🧪 Running Monte Carlo validation (10,000 spins)...")
    
    random.seed(42)  # Reproducible results
    
    counts = {
        Cat.Jackpot: 0,
        Cat.ThreeSame: 0,
        Cat.TwoSame: 0,
        Cat.OneHat: 0,
        Cat.TwoHats: 0,
        Cat.Nothing: 0
    }
    
    num_spins = 10000
    
    for _ in range(num_spins):
        roll = random.randint(0, 9999)
        category, _ = determine_result(roll, 10000)  # Fixed pot for testing
        counts[category] += 1
    
    # Check that probabilities are within reasonable tolerance (±20% relative)
    tolerance = 0.20
    
    jackpot_prob = counts[Cat.Jackpot] / num_spins
    expected_jackpot = P_JACKPOT_BPS / 10000
    assert abs(jackpot_prob - expected_jackpot) / expected_jackpot < tolerance, \
        f"Jackpot probability {jackpot_prob:.4f} not within tolerance of {expected_jackpot:.4f}"
    
    one_hat_prob = counts[Cat.OneHat] / num_spins
    expected_one_hat = P_ONE_HAT_BPS / 10000
    assert abs(one_hat_prob - expected_one_hat) / expected_one_hat < tolerance, \
        f"OneHat probability {one_hat_prob:.4f} not within tolerance of {expected_one_hat:.4f}"
    
    print(f"✅ Monte Carlo validation passed:")
    print(f"   Jackpot: {jackpot_prob:.4f} (expected {expected_jackpot:.4f})")
    print(f"   One Hat: {one_hat_prob:.4f} (expected {expected_one_hat:.4f})")

def main():
    """Run all tests"""
    print("🎰 DegenSlot Contract Logic Tests")
    print("=" * 40)
    
    try:
        test_probability_ranges()
        test_determine_result()
        test_payout_amounts()
        test_jackpot_percentage()
        test_edge_cases()
        test_monte_carlo_validation()
        
        print("\n🎉 All tests passed! Contract logic is working correctly.")
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return False
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
