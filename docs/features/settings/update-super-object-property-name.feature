Feature: Update Super Object Property Name

Scenario: Successful Update
Given the property setting is "extends"
And the following files with respective super object property names:
 | File Name | Super Object Property Name |
 | File1  	 | extends                    |
 | File2     | extends                    |
When I update the property setting to "super"
Then I should see that property setting is "super"
And the super object property names should be:
 | File Name | Super Object Property Name |
 | File1  	 | super        							|
 | File2     | super        							|
