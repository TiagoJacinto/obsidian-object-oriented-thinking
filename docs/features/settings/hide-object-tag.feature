Feature: Hide Object Tag

Scenario: On Enable
Given the setting is disabled
And the following files with respective tags:
 | File Name | Tags                                |
 | File1  	 | SomeTag1, ObjectTag1, SomeOtherTag1 |
 | File2     | SomeTag2, ObjectTag2, SomeOtherTag2 |
When I enable the setting
Then I should see that setting is enabled
And the tags should be:
 | File Name | Tags                    |
 | File1  	 | SomeTag1, SomeOtherTag1 |
 | File2     | SomeTag2, SomeOtherTag2 |

Scenario: On Disable
Given the setting is enabled
And the following files with respective tags:
 | File Name | Tags                    |
 | File1  	 | SomeTag1, SomeOtherTag1 |
 | File2     | SomeTag2, SomeOtherTag2 |
When I disable the setting
Then I should see that setting is disabled
And the tags should be:
 | File Name | Tags                                |
 | File1  	 | SomeTag1, ObjectTag1, SomeOtherTag1 |
 | File2     | SomeTag2, ObjectTag2, SomeOtherTag2 |
