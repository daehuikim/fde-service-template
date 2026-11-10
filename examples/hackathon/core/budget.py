"""예산 규칙(순수 함수). api 층의 쓰기 직전 검증기가 이 함수를 부른다."""


def shortfall(amount: int, spent: int, cost: int) -> int:
    """승인하면 예산을 넘는 금액. 0이면 승인 가능."""
    return max(0, cost - (amount - spent))
